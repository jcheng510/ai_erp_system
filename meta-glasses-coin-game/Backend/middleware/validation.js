const Joi = require('joi');

/**
 * Validate transaction request body
 */
function validateTransaction(req, res, next) {
  const schema = Joi.object({
    amount: Joi.number().integer().min(1).max(100).required(),
    type: Joi.string().valid('Collect', 'Bonus', 'Referral').required(),
    timestamp: Joi.string().isoDate().required(),
    location: Joi.string().pattern(/^-?\d+\.?\d*,-?\d+\.?\d*$/).required()
  });

  const { error } = schema.validate(req.body);

  if (error) {
    return res.status(400).json({
      error: 'Validation Error',
      details: error.details.map(d => d.message)
    });
  }

  next();
}

/**
 * Validate redemption request
 */
function validateRedemption(req, res, next) {
  const schema = Joi.object({
    optionId: Joi.string().uuid().required(),
    coinAmount: Joi.number().integer().min(1).required()
  });

  const { error } = schema.validate(req.body);

  if (error) {
    return res.status(400).json({
      error: 'Validation Error',
      details: error.details.map(d => d.message)
    });
  }

  next();
}

/**
 * Validate user registration
 */
function validateRegistration(req, res, next) {
  const schema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).max(128).required(),
    displayName: Joi.string().min(2).max(50).optional(),
    metaAccountId: Joi.string().optional()
  });

  const { error } = schema.validate(req.body);

  if (error) {
    return res.status(400).json({
      error: 'Validation Error',
      details: error.details.map(d => d.message)
    });
  }

  next();
}

/**
 * Validate cash withdrawal request
 */
function validateCashWithdrawal(req, res, next) {
  const schema = Joi.object({
    amount: Joi.number().integer().min(1000).required(), // Minimum 1000 coins = $1
    paymentMethod: Joi.string().valid('paypal', 'venmo', 'bank').required(),
    paymentDetails: Joi.object({
      email: Joi.string().email().when('...paymentMethod', {
        is: Joi.valid('paypal', 'venmo'),
        then: Joi.required()
      }),
      accountNumber: Joi.string().when('...paymentMethod', {
        is: 'bank',
        then: Joi.required()
      }),
      routingNumber: Joi.string().when('...paymentMethod', {
        is: 'bank',
        then: Joi.required()
      })
    }).required()
  });

  const { error } = schema.validate(req.body);

  if (error) {
    return res.status(400).json({
      error: 'Validation Error',
      details: error.details.map(d => d.message)
    });
  }

  next();
}

/**
 * Validate location data
 */
function validateLocation(req, res, next) {
  const schema = Joi.object({
    lat: Joi.number().min(-90).max(90).required(),
    lng: Joi.number().min(-180).max(180).required(),
    accuracy: Joi.number().min(0).optional(),
    altitude: Joi.number().optional()
  });

  const { error } = schema.validate(req.body);

  if (error) {
    return res.status(400).json({
      error: 'Validation Error',
      details: error.details.map(d => d.message)
    });
  }

  next();
}

/**
 * Generic validation middleware factory
 */
function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      return res.status(400).json({
        error: 'Validation Error',
        details: error.details.map(d => ({
          field: d.path.join('.'),
          message: d.message
        }))
      });
    }

    req.body = value;
    next();
  };
}

module.exports = {
  validateTransaction,
  validateRedemption,
  validateRegistration,
  validateCashWithdrawal,
  validateLocation,
  validate
};
