/* eslint-disable no-unused-vars */
/* eslint-disable quotes */
"use strict";

const stripe = require("stripe")(process.env.STRIPE_KEY);

/**
 * order controller
 */

const { createCoreController } = require("@strapi/strapi").factories;
module.exports = createCoreController("api::order.order", ({ strapi }) => ({
  async create(ctx) {
    const { products } = ctx.request.body.data;

    const lineItems = await Promise.all(
      products.map(async (product) => {
        const item = await strapi.db.query("api::product.product").findOne({
          select: ['title', 'price'],
          where: { id: product.id },
        });

        return {
          price_data: {
            currency: "USD",
            product_data: {
              name: item.title,
            },

            unit_amount: Math.round((item.price * 100) / 56),
          },
          quantity: product.quantity,
        };
      })
    );

    try {
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        success_url: `${process.env.CLIENT_URL}?success=true`,
        cancel_url: `${process.env.CLIENT_URL}?canceled=true`,
        line_items: lineItems,
      });
      await strapi.service("api::order.order").create({
        data: {
          products: products,
          stripe_id: session.id,
        },
      });
      return { stripeSession: session };
    } catch (err) {
      ctx.response.status = 500;
      return err;
    }
  }
}));