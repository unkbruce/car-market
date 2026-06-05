import { ObjectId } from 'mongodb';
import { getDB } from '../config/db.js';

const CARS_COLLECTION = 'cars';
const NUMERIC_FIELDS = ['price', 'year', 'mileage'];
const REQUIRED_FIELDS = ['name', 'company', 'price', 'year'];
const SEARCH_NUMERIC_FIELDS = ['minPrice', 'maxPrice', 'minYear', 'maxYear', 'minMileage', 'maxMileage'];

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

function createRequestError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function validateCarPayload(carData, prefix = '') {
  if (hasMissingRequiredFields(carData)) {
    throw createRequestError(400, `${prefix}name, company, price, and year are required.`);
  }

  if (hasInvalidNumericFields(carData)) {
    throw createRequestError(400, `${prefix}price, year, and mileage must be numbers.`);
  }
}

function buildCarDocument(payload, timestamp) {
  const carData = normalizeCarPayload(payload);

  return {
    ...carData,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseSearchNumber(value, fieldName) {
  if (value === undefined) {
    return undefined;
  }

  if (value === '') {
    const error = new Error(`${fieldName} must be a number.`);
    error.statusCode = 400;
    throw error;
  }

  const parsedValue = Number(value);

  if (Number.isNaN(parsedValue)) {
    const error = new Error(`${fieldName} must be a number.`);
    error.statusCode = 400;
    throw error;
  }

  return parsedValue;
}

function normalizeSearchValues(value) {
  if (value === undefined) {
    return [];
  }

  const values = Array.isArray(value) ? value : String(value).split(',');

  return values.map((item) => String(item).trim()).filter(Boolean);
}

function buildTextFilter(value) {
  const values = normalizeSearchValues(value);

  if (values.length === 0) {
    return undefined;
  }

  if (values.length === 1) {
    return {
      $regex: escapeRegExp(values[0]),
      $options: 'i',
    };
  }

  return {
    $in: values.map((item) => new RegExp(escapeRegExp(item), 'i')),
  };
}

function buildSearchFilter(query) {
  const {
    keyword,
    company,
    type,
    fuel,
    location,
    minPrice,
    maxPrice,
    minYear,
    maxYear,
    minMileage,
    maxMileage,
    transmission,
  } = query;
  const filter = {};

  for (const field of SEARCH_NUMERIC_FIELDS) {
    parseSearchNumber(query[field], field);
  }

  if (keyword) {
    filter.name = {
      $regex: escapeRegExp(keyword),
      $options: 'i',
    };
  }

  const textFilters = {
    company,
    type,
    fuel,
    location,
    transmission,
  };

  for (const [field, value] of Object.entries(textFilters)) {
    const textFilter = buildTextFilter(value);

    if (textFilter) {
      filter[field] = textFilter;
    }
  }

  const parsedMinPrice = parseSearchNumber(minPrice, 'minPrice');
  const parsedMaxPrice = parseSearchNumber(maxPrice, 'maxPrice');

  if (parsedMinPrice !== undefined || parsedMaxPrice !== undefined) {
    filter.price = {};

    if (parsedMinPrice !== undefined) {
      filter.price.$gte = parsedMinPrice;
    }

    if (parsedMaxPrice !== undefined) {
      filter.price.$lte = parsedMaxPrice;
    }
  }

  const parsedMinYear = parseSearchNumber(minYear, 'minYear');
  const parsedMaxYear = parseSearchNumber(maxYear, 'maxYear');

  if (parsedMinYear !== undefined || parsedMaxYear !== undefined) {
    filter.year = {};

    if (parsedMinYear !== undefined) {
      filter.year.$gte = parsedMinYear;
    }

    if (parsedMaxYear !== undefined) {
      filter.year.$lte = parsedMaxYear;
    }
  }

  const parsedMinMileage = parseSearchNumber(minMileage, 'minMileage');
  const parsedMaxMileage = parseSearchNumber(maxMileage, 'maxMileage');

  if (parsedMinMileage !== undefined || parsedMaxMileage !== undefined) {
    filter.mileage = {};

    if (parsedMinMileage !== undefined) {
      filter.mileage.$gte = parsedMinMileage;
    }

    if (parsedMaxMileage !== undefined) {
      filter.mileage.$lte = parsedMaxMileage;
    }
  }

  return filter;
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

export async function searchCars(req, res) {
  try {
    const filter = buildSearchFilter(req.query);
    const cars = await getCarsCollection().find(filter).sort({ createdAt: -1 }).toArray();

    return res.json({
      success: true,
      data: cars,
    });
  } catch (error) {
    return sendError(res, error.statusCode || 500, error.message);
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
    const now = new Date();

    if (Array.isArray(req.body)) {
      if (req.body.length === 0) {
        return sendError(res, 400, 'At least one car is required.');
      }

      const newCars = req.body.map((car, index) => {
        const carData = normalizeCarPayload(car);
        validateCarPayload(carData, `Car at index ${index}: `);

        return {
          ...carData,
          createdAt: now,
          updatedAt: now,
        };
      });

      const result = await getCarsCollection().insertMany(newCars);
      const insertedCars = newCars.map((car, index) => ({
        _id: result.insertedIds[index],
        ...car,
      }));

      return res.status(201).json({
        success: true,
        data: insertedCars,
      });
    }

    const carData = normalizeCarPayload(req.body);
    validateCarPayload(carData);

    const newCar = buildCarDocument(carData, now);

    const result = await getCarsCollection().insertOne(newCar);

    return res.status(201).json({
      success: true,
      data: {
        _id: result.insertedId,
        ...newCar,
      },
    });
  } catch (error) {
    return sendError(res, error.statusCode || 500, error.message);
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
