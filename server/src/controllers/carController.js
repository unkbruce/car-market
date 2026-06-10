import { ObjectId } from 'mongodb';
import { getDB } from '../config/db.js';

const CARS_COLLECTION = 'cars';
const NUMERIC_FIELDS = ['price', 'year', 'mileage'];
const REQUIRED_FIELDS = ['name', 'company', 'price', 'year'];
const SEARCH_NUMERIC_FIELDS = ['minPrice', 'maxPrice', 'minYear', 'maxYear', 'minMileage', 'maxMileage'];
const SEARCH_SORT_FIELDS = new Set(['price', 'year', 'mileage', 'createdAt']);
const DEFAULT_SEARCH_LIMIT = 20;
const MAX_SEARCH_LIMIT = 50;

function isDevelopment() {
  return process.env.NODE_ENV === 'development' || process.env.ENV === 'development';
}
const MIN_IMAGE_ERROR_MESSAGE = '차량 이미지를 최소 1장 이상 선택해주세요.';

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

function parseObjectIds(value) {
  if (value === undefined) {
    return [];
  }

  const values = Array.isArray(value) ? value : String(value).split(',');

  return values
    .map((item) => String(item).trim())
    .filter((item) => isValidObjectId(item))
    .map((item) => new ObjectId(item));
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

function validateCarImages(imageUrls) {
  if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
    throw createRequestError(400, MIN_IMAGE_ERROR_MESSAGE);
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

function getUploadedImageUrls(req) {
  if (!Array.isArray(req.files) || req.files.length === 0) {
    return [];
  }

  return req.files.map((file) => `${req.protocol}://${req.get('host')}/uploads/${file.filename}`);
}

function getUploadedImageNames(req) {
  if (!Array.isArray(req.files) || req.files.length === 0) {
    return [];
  }

  return req.files.map((file) => file.originalname);
}

function normalizeImageFields(payload) {
  const normalized = { ...payload };

  if (Array.isArray(normalized.imageUrls) && normalized.imageUrls.length > 0 && !normalized.imageUrl) {
    normalized.imageUrl = normalized.imageUrls[0];
  }

  return normalized;
}

function parseStringArray(value, fallbackValues = []) {
  if (value === undefined) {
    return fallbackValues;
  }

  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  try {
    const parsedValue = JSON.parse(value);

    if (Array.isArray(parsedValue)) {
      return parsedValue.map((item) => String(item).trim()).filter(Boolean);
    }
  } catch {
    return String(value).split(',').map((item) => item.trim()).filter(Boolean);
  }

  return [];
}

function getImageNamesByKeptUrls(existingCar, keepImageUrls) {
  const existingImageUrls = Array.isArray(existingCar.imageUrls)
    ? existingCar.imageUrls
    : existingCar.imageUrl
      ? [existingCar.imageUrl]
      : [];
  const existingImageNames = Array.isArray(existingCar.imageNames) ? existingCar.imageNames : [];

  return keepImageUrls.map((imageUrl) => {
    const imageIndex = existingImageUrls.indexOf(imageUrl);

    return imageIndex >= 0 ? existingImageNames[imageIndex] || '' : '';
  });
}

function parseSampleImageUrls(payload) {
  return parseStringArray(payload.sampleImageUrls).slice(0, 8);
}

function getRequestUid(req) {
  return req.body?.uid?.trim() || req.query?.uid?.trim() || '';
}

function isOwnedByDealer(car, uid) {
  return Boolean(uid && car?.dealerId && car.dealerId === uid);
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

function parseSearchSort(query) {
  const requestedSortBy = typeof query.sortBy === 'string' ? query.sortBy : '';
  const requestedSortOrder = typeof query.sortOrder === 'string' ? query.sortOrder.toLowerCase() : '';
  const sortBy = SEARCH_SORT_FIELDS.has(requestedSortBy) ? requestedSortBy : 'createdAt';
  const sortOrder = requestedSortOrder === 'asc' ? 1 : -1;
  const parsedLimit = parseSearchNumber(query.limit, 'limit');
  const limit = Math.min(
    Math.max(parsedLimit === undefined ? DEFAULT_SEARCH_LIMIT : parsedLimit, 1),
    MAX_SEARCH_LIMIT,
  );
  const sort = sortBy === 'createdAt'
    ? { createdAt: sortOrder }
    : { [sortBy]: sortOrder, createdAt: -1, price: -1 };

  return {
    sort,
    limit,
  };
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
    excludeIds,
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

  const excludedObjectIds = parseObjectIds(excludeIds);

  if (excludedObjectIds.length > 0) {
    filter._id = {
      $nin: excludedObjectIds,
    };
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
    const { sort, limit } = parseSearchSort(req.query);
    const cars = await getCarsCollection().find(filter).sort(sort).limit(limit).toArray();

    if (isDevelopment()) {
      console.log('Node result years:', cars.map((car) => car.year));
      console.log('Node exclude ids count:', parseObjectIds(req.query.excludeIds).length);
    }

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
    const uploadedImageUrls = getUploadedImageUrls(req);
    const uploadedImageNames = getUploadedImageNames(req);

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

    const sampleImageUrls = uploadedImageUrls.length > 0 ? [] : parseSampleImageUrls(req.body);
    const carData = normalizeCarPayload(normalizeImageFields({
      ...req.body,
      ...(uploadedImageUrls.length > 0
        ? {
            imageUrls: uploadedImageUrls,
            imageNames: uploadedImageNames,
            imageUrl: uploadedImageUrls[0],
          }
        : sampleImageUrls.length > 0
          ? {
              imageUrls: sampleImageUrls,
              imageNames: sampleImageUrls.map(() => ''),
              imageUrl: sampleImageUrls[0],
            }
        : {}),
    }));
    delete carData.sampleImageUrls;
    validateCarPayload(carData);
    validateCarImages(carData.imageUrls);

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
    const uid = getRequestUid(req);

    if (!isValidObjectId(id)) {
      return sendError(res, 400, 'Invalid car id.');
    }

    if (!uid) {
      return sendError(res, 400, 'uid is required.');
    }

    const existingCar = await getCarsCollection().findOne({ _id: new ObjectId(id) });

    if (!existingCar) {
      return sendError(res, 404, 'Car not found.');
    }

    if (!isOwnedByDealer(existingCar, uid)) {
      return sendError(res, 403, 'You can only update your own car.');
    }

    const uploadedImageUrls = getUploadedImageUrls(req);
    const uploadedImageNames = getUploadedImageNames(req);
    const existingImageUrls = Array.isArray(existingCar.imageUrls)
      ? existingCar.imageUrls
      : existingCar.imageUrl
        ? [existingCar.imageUrl]
        : [];
    const keepImageUrls = parseStringArray(req.body.keepImageUrls, existingImageUrls);
    const keepImageNames = req.body.keepImageNames === undefined
      ? getImageNamesByKeptUrls(existingCar, keepImageUrls)
      : parseStringArray(req.body.keepImageNames);
    const sampleImageUrls = parseSampleImageUrls(req.body);
    const sampleImageNames = parseStringArray(req.body.sampleImageNames).slice(0, sampleImageUrls.length);
    const nextImageUrls = [...keepImageUrls, ...uploadedImageUrls, ...sampleImageUrls].slice(0, 8);
    const nextImageNames = [
      ...keepImageNames,
      ...uploadedImageNames,
      ...sampleImageUrls.map((imageUrl, index) => sampleImageNames[index] || imageUrl.split('/').pop() || ''),
    ].slice(0, 8);

    const carData = normalizeCarPayload(normalizeImageFields({
      ...req.body,
      imageUrls: nextImageUrls,
      imageNames: nextImageNames,
      imageUrl: nextImageUrls[0] || '',
    }));

    if (hasInvalidNumericFields(carData)) {
      return sendError(res, 400, 'price, year, and mileage must be numbers.');
    }

    validateCarImages(nextImageUrls);

    const updateData = {
      ...carData,
      updatedAt: new Date(),
    };

    delete updateData._id;
    delete updateData.createdAt;
    delete updateData.uid;
    delete updateData.replaceImages;
    delete updateData.keepImageUrls;
    delete updateData.keepImageNames;
    delete updateData.sampleImageUrls;
    delete updateData.sampleImageNames;
    delete updateData.dealerId;
    delete updateData.dealerName;

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
    const uid = getRequestUid(req);

    if (!isValidObjectId(id)) {
      return sendError(res, 400, 'Invalid car id.');
    }

    if (!uid) {
      return sendError(res, 400, 'uid is required.');
    }

    const existingCar = await getCarsCollection().findOne({ _id: new ObjectId(id) });

    if (!existingCar) {
      return sendError(res, 404, 'Car not found.');
    }

    if (!isOwnedByDealer(existingCar, uid)) {
      return sendError(res, 403, 'You can only delete your own car.');
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
