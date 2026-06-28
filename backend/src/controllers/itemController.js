const Item = require('../models/Item');
const { asyncHandler, createError } = require('../middleware/errorHandler');

const getItems = asyncHandler(async (req, res) => {
  const { search, limit } = req.query;
  let query = { firm: req.firmId };
  if (search) {
    query = {
      $or: [
        { itemName: { $regex: search, $options: 'i' } },
        { itemCode: { $regex: search, $options: 'i' } },
        { hsnCode: { $regex: search, $options: 'i' } },
      ],
      firm: req.firmId
    };
  }
  const items = await Item.find(query).limit(Number(limit) || 200).sort({ itemCode: 1 }).lean();
  res.json({ success: true, data: items, count: items.length });
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
