import { ObjectId } from 'mongodb';
import { getDB } from '../config/db.js';

const CARS_COLLECTION = 'cars';
const NUMERIC_FIELDS = ['price', 'year', 'mileage'];
const REQUIRED_FIELDS = ['name', 'company', 'price', 'year'];

function getCarsCollection() {
  return getDB().collection(CARS_COLLECTION);
}

function sendError(res, statusCode, message) {
  return res.status(statusCode).json({
    success: false,
    message,
  });
}

function isValidObjectId(id) {
  return /^[0-9a-fA-F]{24}$/.test(id) && ObjectId.isValid(id);
}

function normalizeCarPayload(payload) {
  const normalized = { ...payload };

  for (const field of NUMERIC_FIELDS) {
    if (normalized[field] === '') {
      delete normalized[field];
    } else if (normalized[field] !== undefined && normalized[field] !== null) {
      normalized[field] = Number(normalized[field]);
    }
  }

  return normalized;
}

function hasMissingRequiredFields(payload) {
  return REQUIRED_FIELDS.some((field) => payload[field] === undefined || payload[field] === null || payload[field] === '');
}

function hasInvalidNumericFields(payload) {
  return NUMERIC_FIELDS.some((field) => payload[field] !== undefined && Number.isNaN(payload[field]));
}

export async function getCars(req, res) {
  try {
    const cars = await getCarsCollection().find({}).sort({ createdAt: -1 }).toArray();

    return res.json({
      success: true,
      data: cars,
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
}

export async function getCarById(req, res) {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return sendError(res, 400, 'Invalid car id.');
    }

    const car = await getCarsCollection().findOne({ _id: new ObjectId(id) });

    if (!car) {
      return sendError(res, 404, 'Car not found.');
    }

    return res.json({
      success: true,
      data: car,
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
}

export async function createCar(req, res) {
  try {
    const carData = normalizeCarPayload(req.body);

    if (hasMissingRequiredFields(carData)) {
      return sendError(res, 400, 'name, company, price, and year are required.');
    }

    if (hasInvalidNumericFields(carData)) {
      return sendError(res, 400, 'price, year, and mileage must be numbers.');
    }

    const now = new Date();
    const newCar = {
      ...carData,
      createdAt: now,
      updatedAt: now,
    };

    const result = await getCarsCollection().insertOne(newCar);

    return res.status(201).json({
      success: true,
      data: {
        _id: result.insertedId,
        ...newCar,
      },
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
}

export async function updateCar(req, res) {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return sendError(res, 400, 'Invalid car id.');
    }

    const carData = normalizeCarPayload(req.body);

    if (hasInvalidNumericFields(carData)) {
      return sendError(res, 400, 'price, year, and mileage must be numbers.');
    }

    const updateData = {
      ...carData,
      updatedAt: new Date(),
    };

    delete updateData._id;
    delete updateData.createdAt;

    const result = await getCarsCollection().findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateData },
      { returnDocument: 'after' },
    );

    if (!result) {
      return sendError(res, 404, 'Car not found.');
    }

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
}

export async function deleteCar(req, res) {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return sendError(res, 400, 'Invalid car id.');
    }

    const result = await getCarsCollection().deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return sendError(res, 404, 'Car not found.');
    }

    return res.json({
      success: true,
      data: {
        deletedId: id,
      },
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
}
