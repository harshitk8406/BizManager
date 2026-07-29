const Item = require('../models/Item');
const { asyncHandler, createError } = require('../middleware/errorHandler');

const getItems = asyncHandler(async (req, res) => {
  const { search, limit } = req.query;
  const baseQuery = { firm: req.firmId };

  if (!search) {
    const items = await Item.find(baseQuery).limit(Number(limit) || 200).sort({ itemName: 1 }).lean();
    return res.json({ success: true, data: items, count: items.length });
  }

  // Two-pass: prefix matches first, then contains-but-not-prefix
  const cap = Math.min(Number(limit) || 30, 50);
  const prefixQuery = {
    ...baseQuery,
    $or: [
      { itemName: { $regex: `^${search}`, $options: 'i' } },
      { itemCode: { $regex: `^${search}`, $options: 'i' } },
    ],
  };
  const containsQuery = {
    ...baseQuery,
    $or: [
      { itemName: { $regex: search, $options: 'i' } },
      { itemCode: { $regex: search, $options: 'i' } },
      { hsnCode: { $regex: search, $options: 'i' } },
    ],
  };

  const [prefixMatches, allMatches] = await Promise.all([
    Item.find(prefixQuery).sort({ itemName: 1 }).lean(),
    Item.find(containsQuery).limit(cap).sort({ itemName: 1 }).lean(),
  ]);

  // Merge: prefix first, then the rest (deduplicated by _id)
  const prefixIds = new Set(prefixMatches.map(i => i._id));
  const containsOnly = allMatches.filter(i => !prefixIds.has(i._id));
  const merged = [...prefixMatches, ...containsOnly].slice(0, cap);

  res.json({ success: true, data: merged, count: merged.length });
});

const getItemByCode = asyncHandler(async (req, res) => {
  const item = await Item.findOne({ itemCode: req.params.code, firm: req.firmId }).lean();
  if (!item) throw createError('Item not found', 404);
  res.json({ success: true, data: item });
});

const createItem = asyncHandler(async (req, res) => {
  const { itemCode, openingQuantity = 0, ...rest } = req.body;
  const code = itemCode || await Item.generateItemCode(req.firmId);

  const existing = await Item.findOne({ itemCode: code, firm: req.firmId });
  if (existing) throw createError('Item code already exists', 400);

  const item = await Item.create({
    firm: req.firmId,
    itemCode: code,
    openingQuantity,
    closingQuantity: openingQuantity,
    ...rest,
  });
  res.status(201).json({ success: true, data: item });
});

const updateItem = asyncHandler(async (req, res) => {
  const item = await Item.findOneAndUpdate(
    { itemCode: req.params.code, firm: req.firmId },
    req.body,
    { new: true, runValidators: true }
  );
  if (!item) throw createError('Item not found', 404);
  res.json({ success: true, data: item });
});

const deleteItem = asyncHandler(async (req, res) => {
  const item = await Item.findOneAndDelete({ itemCode: req.params.code, firm: req.firmId });
  if (!item) throw createError('Item not found', 404);
  res.json({ success: true, message: 'Item deleted successfully' });
});

module.exports = { getItems, getItemByCode, createItem, updateItem, deleteItem };
