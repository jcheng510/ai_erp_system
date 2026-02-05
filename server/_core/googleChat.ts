/**
 * Google Chat Integration Service
 *
 * Provides functionality to send messages to Google Chat spaces via webhooks.
 * Supports rich card formatting, task notifications, and team mentions.
 */

export interface GoogleChatMessage {
  text?: string;
  cards?: GoogleChatCard[];
  cardsV2?: GoogleChatCardV2[];
}

export interface GoogleChatCard {
  header?: {
    title: string;
    subtitle?: string;
    imageUrl?: string;
    imageStyle?: 'IMAGE' | 'AVATAR';
  };
  sections?: {
    header?: string;
    widgets?: GoogleChatWidget[];
  }[];
}

export interface GoogleChatCardV2 {
  cardId?: string;
  card: {
    header?: {
      title: string;
      subtitle?: string;
      imageUrl?: string;
      imageType?: 'CIRCLE' | 'SQUARE';
    };
    sections?: {
      header?: string;
      collapsible?: boolean;
      widgets?: GoogleChatWidgetV2[];
    }[];
  };
}

export interface GoogleChatWidget {
  textParagraph?: { text: string };
  keyValue?: {
    topLabel?: string;
    content: string;
    icon?: string;
    bottomLabel?: string;
    onClick?: { openLink: { url: string } };
  };
  buttons?: {
    textButton: {
      text: string;
      onClick: { openLink: { url: string } };
    };
  }[];
  image?: {
    imageUrl: string;
    onClick?: { openLink: { url: string } };
  };
}

export interface GoogleChatWidgetV2 {
  textParagraph?: { text: string };
  decoratedText?: {
    topLabel?: string;
    text: string;
    bottomLabel?: string;
    startIcon?: { knownIcon?: string; iconUrl?: string };
    onClick?: { openLink: { url: string } };
  };
  buttonList?: {
    buttons: {
      text: string;
      onClick: { openLink: { url: string } };
      color?: { red: number; green: number; blue: number; alpha?: number };
    }[];
  };
  divider?: {};
  columns?: {
    columnItems: {
      widgets: GoogleChatWidgetV2[];
    }[];
  };
}

export interface SendMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface TaskNotification {
  taskId: number;
  taskName: string;
  projectName?: string;
  assigneeName?: string;
  assigneeGoogleChatId?: string;
  status?: string;
  priority?: string;
  dueDate?: Date | string;
  description?: string;
  actionUrl?: string;
  notificationType: 'created' | 'assigned' | 'completed' | 'status_changed' | 'due_soon' | 'overdue' | 'commented';
  actorName?: string;
  comment?: string;
}

/**
 * Send a plain text message to a Google Chat space via webhook
 */
export async function sendChatMessage(
  webhookUrl: string,
  text: string
): Promise<SendMessageResult> {
  if (!webhookUrl) {
    return { success: false, error: 'Webhook URL is required' };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error(`[GoogleChat] Failed to send message: ${response.status} ${response.statusText}`, errorText);
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`
      };
    }

    const result = await response.json().catch(() => ({}));
    return {
      success: true,
      messageId: result.name || result.messageId
    };
  } catch (error: any) {
    console.error('[GoogleChat] Error sending message:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send a rich card message to a Google Chat space
 */
export async function sendChatCard(
  webhookUrl: string,
  message: GoogleChatMessage
): Promise<SendMessageResult> {
  if (!webhookUrl) {
    return { success: false, error: 'Webhook URL is required' };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error(`[GoogleChat] Failed to send card: ${response.status} ${response.statusText}`, errorText);
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`
      };
    }

    const result = await response.json().catch(() => ({}));
    return {
      success: true,
      messageId: result.name || result.messageId
    };
  } catch (error: any) {
    console.error('[GoogleChat] Error sending card:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Format a due date for display
 */
function formatDueDate(date: Date | string | undefined): string {
  if (!date) return 'No due date';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
  });
}

/**
 * Get priority emoji
 */
function getPriorityEmoji(priority?: string): string {
  switch (priority?.toLowerCase()) {
    case 'critical':
    case 'urgent':
      return '🔴';
    case 'high':
      return '🟠';
    case 'medium':
      return '🟡';
    case 'low':
      return '🟢';
    default:
      return '⚪';
  }
}

/**
 * Get status emoji
 */
function getStatusEmoji(status?: string): string {
  switch (status?.toLowerCase()) {
    case 'completed':
    case 'done':
      return '✅';
    case 'in_progress':
      return '🔄';
    case 'review':
      return '👁️';
    case 'todo':
      return '📋';
    case 'backlog':
      return '📦';
    case 'cancelled':
      return '❌';
    default:
      return '📌';
  }
}

/**
 * Build notification title based on type
 */
function buildNotificationTitle(notification: TaskNotification): string {
  switch (notification.notificationType) {
    case 'created':
      return '📝 New Task Created';
    case 'assigned':
      return '👤 Task Assigned';
    case 'completed':
      return '✅ Task Completed';
    case 'status_changed':
      return '🔄 Status Updated';
    case 'due_soon':
      return '⏰ Task Due Soon';
    case 'overdue':
      return '🚨 Task Overdue';
    case 'commented':
      return '💬 New Comment';
    default:
      return '📋 Task Update';
  }
}

/**
 * Build notification subtitle based on type
 */
function buildNotificationSubtitle(notification: TaskNotification): string {
  const { actorName, assigneeName, projectName } = notification;

  switch (notification.notificationType) {
    case 'created':
      return actorName
        ? `Created by ${actorName}${projectName ? ` in ${projectName}` : ''}`
        : projectName || 'New task';
    case 'assigned':
      return assigneeName
        ? `Assigned to ${assigneeName}${actorName ? ` by ${actorName}` : ''}`
        : 'Task assignment';
    case 'completed':
      return actorName
        ? `Completed by ${actorName}`
        : 'Task marked complete';
    case 'status_changed':
      return actorName
        ? `Updated by ${actorName}`
        : 'Status changed';
    case 'due_soon':
      return `Due ${formatDueDate(notification.dueDate)}`;
    case 'overdue':
      return `Was due ${formatDueDate(notification.dueDate)}`;
    case 'commented':
      return actorName
        ? `${actorName} commented`
        : 'New comment';
    default:
      return projectName || '';
  }
}

/**
 * Send a task notification card to Google Chat
 */
export async function sendTaskNotification(
  webhookUrl: string,
  notification: TaskNotification
): Promise<SendMessageResult> {
  if (!webhookUrl) {
    return { success: false, error: 'Webhook URL is required' };
  }

  const {
    taskName,
    projectName,
    assigneeName,
    assigneeGoogleChatId,
    status,
    priority,
    dueDate,
    description,
    actionUrl,
    notificationType,
    comment
  } = notification;

  // Build mention text if assignee has Google Chat ID
  const mentionText = assigneeGoogleChatId
    ? `<users/${assigneeGoogleChatId}> `
    : '';

  // Build the card message
  const message: GoogleChatMessage = {
    text: mentionText ? `${mentionText}You have a task update` : undefined,
    cardsV2: [{
      cardId: `task-${notification.taskId}`,
      card: {
        header: {
          title: buildNotificationTitle(notification),
          subtitle: buildNotificationSubtitle(notification),
          imageType: 'CIRCLE',
        },
        sections: [
          // Task name section
          {
            widgets: [
              {
                decoratedText: {
                  topLabel: 'Task',
                  text: `<b>${taskName}</b>`,
                  startIcon: { knownIcon: 'BOOKMARK' },
                },
              },
            ],
          },
          // Details section
          {
            header: 'Details',
            widgets: [
              // Status and Priority row
              {
                columns: {
                  columnItems: [
                    {
                      widgets: [{
                        decoratedText: {
                          topLabel: 'Status',
                          text: status ? `${getStatusEmoji(status)} ${status.replace('_', ' ')}` : 'Not set',
                        },
                      }],
                    },
                    {
                      widgets: [{
                        decoratedText: {
                          topLabel: 'Priority',
                          text: priority ? `${getPriorityEmoji(priority)} ${priority}` : 'Not set',
                        },
                      }],
                    },
                  ],
                },
              },
              // Due date and Assignee row
              {
                columns: {
                  columnItems: [
                    {
                      widgets: [{
                        decoratedText: {
                          topLabel: 'Due Date',
                          text: formatDueDate(dueDate),
                          startIcon: { knownIcon: 'CLOCK' },
                        },
                      }],
                    },
                    {
                      widgets: [{
                        decoratedText: {
                          topLabel: 'Assignee',
                          text: assigneeName || 'Unassigned',
                          startIcon: { knownIcon: 'PERSON' },
                        },
                      }],
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
    }],
  };

  // Add project info if available
  if (projectName && message.cardsV2?.[0]?.card.sections) {
    message.cardsV2[0].card.sections[1].widgets?.push({
      decoratedText: {
        topLabel: 'Project',
        text: projectName,
        startIcon: { knownIcon: 'DESCRIPTION' },
      },
    });
  }

  // Add description if available (truncate if too long)
  if (description && message.cardsV2?.[0]?.card.sections) {
    const truncatedDesc = description.length > 200
      ? description.substring(0, 200) + '...'
      : description;
    message.cardsV2[0].card.sections.push({
      widgets: [{
        textParagraph: { text: truncatedDesc },
      }],
    });
  }

  // Add comment if this is a comment notification
  if (notificationType === 'commented' && comment && message.cardsV2?.[0]?.card.sections) {
    const truncatedComment = comment.length > 300
      ? comment.substring(0, 300) + '...'
      : comment;
    message.cardsV2[0].card.sections.push({
      header: 'Comment',
      widgets: [{
        textParagraph: { text: truncatedComment },
      }],
    });
  }

  // Add action button if URL provided
  if (actionUrl && message.cardsV2?.[0]?.card.sections) {
    message.cardsV2[0].card.sections.push({
      widgets: [{
        buttonList: {
          buttons: [{
            text: 'View Task',
            onClick: { openLink: { url: actionUrl } },
            color: { red: 0.098, green: 0.388, blue: 0.976 }, // Google Blue
          }],
        },
      }],
    });
  }

  return sendChatCard(webhookUrl, message);
}

/**
 * Send a simple task assignment notification
 */
export async function sendTaskAssignmentNotification(
  webhookUrl: string,
  taskName: string,
  assigneeName: string,
  assignerName: string,
  projectName?: string,
  dueDate?: Date | string,
  actionUrl?: string,
  assigneeGoogleChatId?: string
): Promise<SendMessageResult> {
  return sendTaskNotification(webhookUrl, {
    taskId: 0,
    taskName,
    projectName,
    assigneeName,
    assigneeGoogleChatId,
    dueDate,
    actionUrl,
    notificationType: 'assigned',
    actorName: assignerName,
  });
}

/**
 * Send a due date reminder notification
 */
export async function sendDueDateReminder(
  webhookUrl: string,
  taskName: string,
  assigneeName: string,
  dueDate: Date | string,
  daysUntilDue: number,
  projectName?: string,
  actionUrl?: string,
  assigneeGoogleChatId?: string
): Promise<SendMessageResult> {
  const isOverdue = daysUntilDue < 0;

  return sendTaskNotification(webhookUrl, {
    taskId: 0,
    taskName,
    projectName,
    assigneeName,
    assigneeGoogleChatId,
    dueDate,
    actionUrl,
    notificationType: isOverdue ? 'overdue' : 'due_soon',
  });
}

/**
 * Send a batch of task notifications (for daily digests)
 */
export async function sendTaskDigest(
  webhookUrl: string,
  title: string,
  tasks: {
    name: string;
    status?: string;
    priority?: string;
    dueDate?: Date | string;
    assigneeName?: string;
  }[],
  actionUrl?: string
): Promise<SendMessageResult> {
  if (!webhookUrl) {
    return { success: false, error: 'Webhook URL is required' };
  }

  if (tasks.length === 0) {
    return { success: false, error: 'No tasks to send' };
  }

  // Build task list widgets
  const taskWidgets: GoogleChatWidgetV2[] = tasks.slice(0, 10).map(task => ({
    decoratedText: {
      text: `${getStatusEmoji(task.status)} ${task.name}`,
      bottomLabel: [
        task.priority ? `${getPriorityEmoji(task.priority)} ${task.priority}` : '',
        task.dueDate ? `Due: ${formatDueDate(task.dueDate)}` : '',
        task.assigneeName ? `→ ${task.assigneeName}` : '',
      ].filter(Boolean).join(' | '),
    },
  }));

  // Add divider between tasks
  const widgetsWithDividers: GoogleChatWidgetV2[] = taskWidgets.flatMap((widget, index) =>
    index < taskWidgets.length - 1 ? [widget, { divider: {} }] : [widget]
  );

  const message: GoogleChatMessage = {
    cardsV2: [{
      cardId: 'task-digest',
      card: {
        header: {
          title,
          subtitle: `${tasks.length} task${tasks.length === 1 ? '' : 's'}`,
          imageType: 'CIRCLE',
        },
        sections: [
          { widgets: widgetsWithDividers },
        ],
      },
    }],
  };

  // Add "View More" text if truncated
  if (tasks.length > 10) {
    message.cardsV2![0].card.sections!.push({
      widgets: [{
        textParagraph: { text: `... and ${tasks.length - 10} more tasks` },
      }],
    });
  }

  // Add action button
  if (actionUrl) {
    message.cardsV2![0].card.sections!.push({
      widgets: [{
        buttonList: {
          buttons: [{
            text: 'View All Tasks',
            onClick: { openLink: { url: actionUrl } },
            color: { red: 0.098, green: 0.388, blue: 0.976 },
          }],
        },
      }],
    });
  }

  return sendChatCard(webhookUrl, message);
}

/**
 * Test webhook connection by sending a test message
 */
export async function testWebhookConnection(
  webhookUrl: string
): Promise<SendMessageResult> {
  return sendChatMessage(
    webhookUrl,
    '✅ Webhook connection test successful! This space is now connected to the Project Management system.'
  );
}
