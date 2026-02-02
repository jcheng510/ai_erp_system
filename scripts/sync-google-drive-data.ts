/**
 * Script to sync Google Drive folder "_Data Room" to the data room
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import { desc, eq } from "drizzle-orm";
import {
  googleOAuthTokens,
  dataRooms,
  dataRoomFolders,
  dataRoomDocuments,
  users,
} from "../drizzle/schema";
import {
  listDriveFolders,
  syncDriveFolder,
  downloadFile,
  getSimpleFileType,
  DriveFile,
} from "../server/_core/googleDrive";
import { storagePut } from "../server/storage";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("Error: DATABASE_URL environment variable not set.");
  console.error("\nPlease set up your .env file with:");
  console.error("  DATABASE_URL=mysql://user:password@localhost:3306/ai_erp_system");
  console.error("  GOOGLE_CLIENT_ID=your_google_client_id");
  console.error("  GOOGLE_CLIENT_SECRET=your_google_client_secret");
  console.error("\nOr copy .env.example to .env and fill in the values.");
  process.exit(1);
}

const db = drizzle(DATABASE_URL);

// Allow passing folder name as argument, default to "_Data Room"
const TARGET_FOLDER_NAME = process.argv[2] || "_Data Room";

interface SyncResult {
  filesScanned: number;
  filesAdded: number;
  filesUpdated: number;
  filesSkipped: number;
  foldersCreated: number;
  warnings: string[];
}

// Map of Drive folder IDs to data room folder IDs
const folderMapping = new Map<string, number>();

/**
 * Refresh Google OAuth token if expired
 */
async function refreshTokenIfNeeded(token: typeof googleOAuthTokens.$inferSelect): Promise<string> {
  const now = new Date();
  const expiresAt = token.expiresAt ? new Date(token.expiresAt) : null;

  // If token is still valid (with 5 minute buffer), return it
  if (expiresAt && expiresAt.getTime() > now.getTime() + 5 * 60 * 1000) {
    return token.accessToken;
  }

  // Need to refresh
  if (!token.refreshToken) {
    throw new Error("Token expired and no refresh token available. Please re-authenticate with Google.");
  }

  console.log("Access token expired, refreshing...");

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not configured");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: token.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh token: ${error}`);
  }

  const data = await response.json();

  // Update token in database
  const newExpiresAt = new Date(Date.now() + (data.expires_in - 60) * 1000);
  await db.update(googleOAuthTokens)
    .set({
      accessToken: data.access_token,
      expiresAt: newExpiresAt,
    })
    .where(eq(googleOAuthTokens.id, token.id));

  console.log("Token refreshed successfully");
  return data.access_token;
}

/**
 * Find the "_Data Room" folder in Google Drive
 */
async function findTargetFolder(accessToken: string): Promise<{ id: string; name: string } | null> {
  console.log(`\nSearching for folder "${TARGET_FOLDER_NAME}" in Google Drive...`);

  // List root folders
  const { folders, error } = await listDriveFolders(accessToken);

  if (error) {
    console.error("Error listing folders:", error);
    return null;
  }

  console.log(`Found ${folders.length} folders in root`);

  // Look for exact match first
  let targetFolder = folders.find(f => f.name === TARGET_FOLDER_NAME);

  if (targetFolder) {
    console.log(`Found folder: "${targetFolder.name}" (ID: ${targetFolder.id})`);
    return { id: targetFolder.id, name: targetFolder.name };
  }

  // Try case-insensitive match
  targetFolder = folders.find(f => f.name.toLowerCase() === TARGET_FOLDER_NAME.toLowerCase());

  if (targetFolder) {
    console.log(`Found folder (case-insensitive): "${targetFolder.name}" (ID: ${targetFolder.id})`);
    return { id: targetFolder.id, name: targetFolder.name };
  }

  // List all folders for debugging
  console.log("\nAvailable folders:");
  folders.forEach(f => console.log(`  - ${f.name}`));

  return null;
}

/**
 * Get or create a data room for syncing
 */
async function getOrCreateDataRoom(folderName: string, ownerId: number): Promise<number> {
  // Check if a data room with this name already exists
  const existing = await db.select()
    .from(dataRooms)
    .where(eq(dataRooms.name, folderName))
    .limit(1);

  if (existing.length > 0) {
    console.log(`Using existing data room: "${existing[0].name}" (ID: ${existing[0].id})`);
    return existing[0].id;
  }

  // Create a new data room
  const slug = folderName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const result = await db.insert(dataRooms).values({
    name: folderName,
    description: `Synced from Google Drive folder: ${folderName}`,
    slug: `${slug}-${Date.now()}`,
    ownerId,
    isPublic: false,
    invitationOnly: true,
    requireEmailVerification: false,
    requiresNda: false,
    allowDownload: true,
    allowPrint: false,
    enableWatermark: false,
  });

  const dataRoomId = result[0].insertId;
  console.log(`Created new data room: "${folderName}" (ID: ${dataRoomId})`);

  return dataRoomId;
}

/**
 * Download a file from Google Drive and upload to storage
 */
async function downloadAndUploadFile(
  file: DriveFile,
  accessToken: string,
  dataRoomId: number
): Promise<{ url: string; key: string } | null> {
  try {
    console.log(`    Downloading: ${file.name}`);

    const { content, error } = await downloadFile(accessToken, file.id, file.mimeType);

    if (error || !content) {
      console.error(`    Failed to download ${file.name}: ${error}`);
      return null;
    }

    // Upload to storage
    const key = `dataroom/${dataRoomId}/drive-sync/${Date.now()}-${file.name}`;
    const result = await storagePut(key, content, file.mimeType);

    if (!result.url) {
      console.error(`    Failed to upload ${file.name}`);
      return null;
    }

    console.log(`    Uploaded: ${file.name}`);
    return { url: result.url, key };
  } catch (error: any) {
    console.error(`    Error processing ${file.name}: ${error.message}`);
    return null;
  }
}

/**
 * Main sync function
 */
async function syncGoogleDriveData(): Promise<SyncResult> {
  const result: SyncResult = {
    filesScanned: 0,
    filesAdded: 0,
    filesUpdated: 0,
    filesSkipped: 0,
    foldersCreated: 0,
    warnings: [],
  };

  try {
    // Get OAuth token from database
    console.log("Getting Google OAuth token from database...");
    const tokens = await db.select().from(googleOAuthTokens).limit(1);

    if (tokens.length === 0) {
      throw new Error("No Google OAuth token found. Please connect your Google account first through the app.");
    }

    const token = tokens[0];
    console.log(`Found token for user ID: ${token.userId}`);

    // Refresh token if needed
    const accessToken = await refreshTokenIfNeeded(token);

    // Find the target folder
    const targetFolder = await findTargetFolder(accessToken);

    if (!targetFolder) {
      throw new Error(`Folder "${TARGET_FOLDER_NAME}" not found in Google Drive`);
    }

    // Get or create data room
    const dataRoomId = await getOrCreateDataRoom(targetFolder.name, token.userId);

    // Get existing documents to check for duplicates
    const existingDocs = await db.select()
      .from(dataRoomDocuments)
      .where(eq(dataRoomDocuments.dataRoomId, dataRoomId));

    const existingDocsByDriveId = new Map<string, typeof dataRoomDocuments.$inferSelect>();
    existingDocs.forEach(doc => {
      if (doc.googleDriveFileId) {
        existingDocsByDriveId.set(doc.googleDriveFileId, doc);
      }
    });

    // Get existing folders
    const existingFolders = await db.select()
      .from(dataRoomFolders)
      .where(eq(dataRoomFolders.dataRoomId, dataRoomId));

    existingFolders.forEach(folder => {
      if (folder.googleDriveFolderId) {
        folderMapping.set(folder.googleDriveFolderId, folder.id);
      }
    });

    // Sync folder structure from Google Drive
    console.log("\nSyncing folder structure from Google Drive...");
    const syncResult = await syncDriveFolder(accessToken, targetFolder.id, 10);

    if (!syncResult.success) {
      throw new Error(syncResult.error || "Failed to sync folder structure");
    }

    console.log(`Found ${syncResult.folders.length} folders and ${syncResult.files.length} files`);
    result.filesScanned = syncResult.files.length;

    // Process folders first
    console.log("\nCreating folder structure...");
    for (const driveFolder of syncResult.folders) {
      if (!folderMapping.has(driveFolder.id)) {
        // Determine parent folder
        let parentId: number | null = null;
        if (driveFolder.parents && driveFolder.parents.length > 0) {
          const parentDriveId = driveFolder.parents[0];
          if (folderMapping.has(parentDriveId)) {
            parentId = folderMapping.get(parentDriveId)!;
          }
        }

        // Create folder in data room
        const folderResult = await db.insert(dataRoomFolders).values({
          dataRoomId,
          parentId,
          name: driveFolder.name,
          googleDriveFolderId: driveFolder.id,
          sortOrder: 0,
        });

        folderMapping.set(driveFolder.id, folderResult[0].insertId);
        result.foldersCreated++;
        console.log(`  Created folder: ${driveFolder.name}`);
      }
    }

    // Process files
    console.log("\nSyncing files...");
    for (const file of syncResult.files) {
      try {
        // Determine folder ID
        let folderId: number | null = null;
        if (file.parents && file.parents.length > 0) {
          const parentDriveId = file.parents[0];
          if (folderMapping.has(parentDriveId)) {
            folderId = folderMapping.get(parentDriveId)!;
          }
        }

        const existingDoc = existingDocsByDriveId.get(file.id);

        if (existingDoc) {
          // Check if file has been modified
          const driveModified = file.modifiedTime ? new Date(file.modifiedTime).getTime() : 0;
          const docModified = existingDoc.updatedAt ? new Date(existingDoc.updatedAt).getTime() : 0;

          if (driveModified > docModified) {
            // File has been updated - re-download
            const downloaded = await downloadAndUploadFile(file, accessToken, dataRoomId);

            if (downloaded) {
              await db.update(dataRoomDocuments)
                .set({
                  name: file.name,
                  folderId,
                  storageUrl: downloaded.url,
                  storageKey: downloaded.key,
                  fileSize: file.size ? parseInt(file.size) : undefined,
                  mimeType: file.mimeType,
                })
                .where(eq(dataRoomDocuments.id, existingDoc.id));

              result.filesUpdated++;
              console.log(`  Updated: ${file.name}`);
            } else {
              result.warnings.push(`Failed to update "${file.name}"`);
            }
          } else {
            result.filesSkipped++;
            console.log(`  Skipped (unchanged): ${file.name}`);
          }
        } else {
          // New file - download and create
          const downloaded = await downloadAndUploadFile(file, accessToken, dataRoomId);

          if (downloaded) {
            await db.insert(dataRoomDocuments).values({
              dataRoomId,
              folderId,
              name: file.name,
              fileType: getSimpleFileType(file.mimeType),
              mimeType: file.mimeType,
              fileSize: file.size ? parseInt(file.size) : undefined,
              storageType: "s3",
              storageUrl: downloaded.url,
              storageKey: downloaded.key,
              googleDriveFileId: file.id,
              googleDriveWebViewLink: file.webViewLink,
              thumbnailUrl: file.thumbnailLink,
              sortOrder: 0,
            });

            result.filesAdded++;
            console.log(`  Added: ${file.name}`);
          } else {
            result.warnings.push(`Failed to download "${file.name}"`);
          }
        }
      } catch (fileError: any) {
        result.warnings.push(`Error processing "${file.name}": ${fileError.message}`);
        console.error(`  Error: ${file.name} - ${fileError.message}`);
      }
    }

    return result;
  } catch (error: any) {
    console.error("\nSync error:", error.message);
    throw error;
  }
}

// Run the sync
async function main() {
  console.log("=".repeat(60));
  console.log("Google Drive Sync - Data Room");
  console.log("=".repeat(60));
  console.log(`Target folder: "${TARGET_FOLDER_NAME}"`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log("");
  console.log("Usage: tsx scripts/sync-google-drive-data.ts [folder_name]");
  console.log("       Default folder name is '_Data Room'");
  console.log("=".repeat(60));

  const startTime = Date.now();

  try {
    const result = await syncGoogleDriveData();

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log("\n" + "=".repeat(60));
    console.log("SYNC COMPLETE");
    console.log("=".repeat(60));
    console.log(`Duration: ${duration}s`);
    console.log(`Files scanned: ${result.filesScanned}`);
    console.log(`Files added: ${result.filesAdded}`);
    console.log(`Files updated: ${result.filesUpdated}`);
    console.log(`Files skipped: ${result.filesSkipped}`);
    console.log(`Folders created: ${result.foldersCreated}`);

    if (result.warnings.length > 0) {
      console.log(`\nWarnings (${result.warnings.length}):`);
      result.warnings.forEach(w => console.log(`  - ${w}`));
    }

    console.log("=".repeat(60));
    process.exit(0);
  } catch (error: any) {
    console.error("\n" + "=".repeat(60));
    console.error("SYNC FAILED");
    console.error("=".repeat(60));
    console.error(error.message);
    console.error("=".repeat(60));
    process.exit(1);
  }
}

main();
