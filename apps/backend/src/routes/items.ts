import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { prisma } from '../lib/prisma';
import { errorResponse, successResponse } from '../lib/utils';
import { Prisma } from '../../generated/prisma/client';

/** @ts-ignore */
const jsonValueSchema: z.ZodType<z.infer<typeof jsonValueSchema>> = z.lazy(() =>
    z.union([
        z.string(),
        z.number(),
        z.boolean(),
        z.null(),
        z.array(jsonValueSchema),
        z.record(z.string(), jsonValueSchema),
    ])
);

const createItemSchema = z.object({
    name: z.string().min(1, '名称不能为空'),
    source: z.string().optional().nullable(),
    category: z.string().optional().nullable(),

    quantity: z
        .string()
        .regex(/^\d+(\.\d{1,3})?$/, '数量格式无效，最多3位小数')
        .optional()
        .nullable(),
    unit: z.string().optional().nullable(),

    usedQuantity: z
        .string()
        .regex(/^\d+(\.\d{1,3})?$/, '已使用量格式无效，最多3位小数')
        .optional()
        .nullable()
        .default('0.0'),

    productionDate: z
        .string()
        .datetime({ message: '生产日期必须是 ISO 8601 格式' })
        .optional()
        .nullable(),
    expiryDate: z
        .string()
        .datetime({ message: '过期日期必须是 ISO 8601 格式' })
        .optional()
        .nullable(),

    locationId: z.number().int().positive().optional().nullable(),

    price: z
        .string()
        .regex(/^\d+(\.\d{1,2})?$/, '价格格式无效，最多2位小数')
        .optional()
        .nullable(),

    extraInfo: z.record(z.string(), jsonValueSchema).optional(), // JSON 对象
});


const items = new Hono().get('/', async (c) => {
    try {
        const allItems = await prisma.item.findMany({
            include: {
                location: true,
                images: {
                    orderBy: { sortOrder: 'asc' },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        return successResponse(allItems);
    } catch (error) {
        console.error('Error fetching items:', error);
        return errorResponse('获取物品列表失败', 500);
    }
}).post(
    '/',
    zValidator('form', createItemSchema),
    async (c) => {
        const data = c.req.valid('form');

        try {
            const newItem = await prisma.item.create({
                data: {
                    name: data.name.trim(),
                    source: data.source?.trim() || null,

                    // 处理 Decimal 字段：Prisma 接受 string 形式的数字
                    quantity: data.quantity ? data.quantity : null,
                    unit: data.unit?.trim() || null,
                    usedQuantity: data.usedQuantity, // 默认 '0.0'，已由 Zod 处理

                    // 日期字段：Zod 已确保是 ISO 字符串或 null
                    productionDate: data.productionDate ? new Date(data.productionDate) : null,
                    expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,

                    locationId: data.locationId ?? undefined,

                    price: data.price ? data.price : null,

                    extraInfo: data.extraInfo,
                },
                include: {
                    location: true,
                    images: {
                        orderBy: { sortOrder: 'asc' },
                    },
                },
            });

            return successResponse(newItem, 201);
        } catch (error) {
            console.error('Error creating item:', error);
            return errorResponse('创建物品失败', 500);
        }
    }
).put(
    '/:id',
    zValidator('form', createItemSchema.partial().extend({})),
    async (c) => {
        const id = Number(c.req.param('id'));
        if (isNaN(id) || id <= 0) {
            return errorResponse('无效的物品 ID', 400);
        }

        const data = c.req.valid('form');

        // 构建更新数据
        const updateData: any = {};
        if (data.name !== undefined) updateData.name = data.name?.trim() || null;
        if (data.source !== undefined) updateData.source = data.source?.trim() || null;
        if (data.quantity !== undefined) updateData.quantity = data.quantity;
        if (data.unit !== undefined) updateData.unit = data.unit?.trim() || null;
        if (data.usedQuantity !== undefined) updateData.usedQuantity = data.usedQuantity;
        if (data.productionDate !== undefined) {
            updateData.productionDate = data.productionDate ? new Date(data.productionDate) : null;
        }
        if (data.expiryDate !== undefined) {
            updateData.expiryDate = data.expiryDate ? new Date(data.expiryDate) : null;
        }
        if (data.locationId !== undefined) updateData.locationId = data.locationId ?? null;
        if (data.price !== undefined) updateData.price = data.price;
        if (data.extraInfo !== undefined) updateData.extraInfo = data.extraInfo;


        try {
            const updatedItem = await prisma.item.update({
                where: { id },
                data: updateData,
                include: {
                    location: true,
                    images: { orderBy: { sortOrder: 'asc' } },
                },
            });
            return successResponse(updatedItem);
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError) {
                if (error.code === 'P2025') {
                    return errorResponse('物品未找到', 404);
                }
            }
            console.error('Error updating item:', error);
            return errorResponse('更新物品失败', 500);
        }
    }
).delete('/:id', async (c) => {
    const id = Number(c.req.param('id'));
    if (isNaN(id) || id <= 0) {
        return errorResponse('无效的物品 ID', 400);
    }

    try {
        await prisma.item.delete({ where: { id } });
        return successResponse({ message: '物品已成功删除' });
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
            return errorResponse('物品未找到', 404);
        }
        console.error('Error deleting item:', error);
        return errorResponse('删除物品失败', 500);
    }
});

export default items;