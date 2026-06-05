import { getDB } from '../config/db.js';

const USERS_COLLECTION = 'users';
const VALID_ROLES = ['buyer', 'dealer'];

function getUsersCollection() {
  return getDB().collection(USERS_COLLECTION);
}

function sendError(res, statusCode, message) {
  return res.status(statusCode).json({
    success: false,
    message,
  });
}

function normalizeUserPayload(payload) {
  return {
    uid: payload.uid?.trim(),
    email: payload.email?.trim(),
    displayName: payload.displayName?.trim() || '',
    role: payload.role?.trim() || 'buyer',
  };
}

function validateUserPayload(userData) {
  if (!userData.uid || !userData.email) {
    return 'uid and email are required.';
  }

  if (!VALID_ROLES.includes(userData.role)) {
    return 'role must be buyer or dealer.';
  }

  return '';
}

export async function createOrUpdateUser(req, res) {
  try {
    const userData = normalizeUserPayload(req.body);
    const validationError = validateUserPayload(userData);

    if (validationError) {
      return sendError(res, 400, validationError);
    }

    const now = new Date();
    const result = await getUsersCollection().findOneAndUpdate(
      { uid: userData.uid },
      {
        $set: {
          email: userData.email,
          displayName: userData.displayName,
          role: userData.role,
          updatedAt: now,
        },
        $setOnInsert: {
          uid: userData.uid,
          createdAt: now,
        },
      },
      {
        upsert: true,
        returnDocument: 'after',
      },
    );

    return res.status(201).json({
      success: true,
      data: result?.value || result,
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
}

export async function getMyProfile(req, res) {
  try {
    const uid = req.query.uid?.trim();

    if (!uid) {
      return sendError(res, 400, 'uid query parameter is required.');
    }

    const user = await getUsersCollection().findOne({ uid });

    if (!user) {
      return sendError(res, 404, 'User not found.');
    }

    return res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
}

export async function getDealers(req, res) {
  try {
    const dealers = await getUsersCollection().find({ role: 'dealer' }).sort({ createdAt: -1 }).toArray();

    return res.json({
      success: true,
      data: dealers,
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
}
