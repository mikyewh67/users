# HandleVault Store

A ready-to-deploy serverless storefront for selling curated Instagram/TikTok handles.

## What this build does
- Public inventory with Instagram/TikTok + 3L/4L filters and price sorting.
- Manual checkout for Cash App, Zelle, PayPal, or crypto.
- Customers submit sender + transaction/reference details **after sending payment**.
- The selected handle is reserved for 30 minutes in Supabase.
- A private Telegram bot alert includes: order ID, handle, platform, supplier, your cost, sale price, gross spread, payment method, payment reference, and buyer email.
- `/admin.html` lets you load an order, manually verify payment, and either fulfill or release it.
- Fulfillment emails transfer instructions to the buyer through Resend and marks the handle sold.
- Customers can track pending / fulfilled / cancelled status by order ID.

## Why Vercel instead of plain GitHub Pages
GitHub Pages is static. It would expose any Telegram/email/API secrets placed in browser JavaScript. Vercel runs the `/api/*` files server-side and keeps environment variables private.

## Setup
1. Create a free Supabase project.
2. Open Supabase → SQL Editor → run `supabase-setup.sql` once. This creates the tables/functions and imports all 80 handles.
3. Create a Telegram bot with BotFather, send it a message, and get your bot token + private chat ID.
4. Create a Resend account/domain for fulfillment email.
5. Create an empty GitHub repository and upload every file/folder in this project.
6. In Vercel, choose **Add New → Project**, import the GitHub repository, and deploy it as-is. No build command is required.
7. In the Vercel project, add every variable from `.env.example` under **Settings → Environment Variables**, replacing the placeholders with your real values. Redeploy after adding them.
8. Visit `/admin.html` on your deployed domain for fulfillment.

## Payment behavior
Cash App and Zelle do not become verified merely because a customer submits the form. The Telegram alert explicitly tells you to independently verify receipt before buying/fulfilling. PayPal and crypto are also manual in this v1 build. You can add payment webhooks later if your providers/account types support them.

## Security notes
- Never put `SUPABASE_SERVICE_ROLE_KEY`, `TELEGRAM_BOT_TOKEN`, `RESEND_API_KEY`, or `ADMIN_SECRET` in `app.js` or any public HTML.
- Use a long random `ADMIN_SECRET`.
- Prefer transfer instructions / one-time recovery details rather than reusable passwords in plaintext email where possible.
- Change/revoke supplier credentials and recovery methods during transfer as appropriate.
- Review the terms and acceptable-use rules of the social platform and each payment provider before selling transferable usernames/accounts.

## Editing inventory
Your public prices are in Supabase after setup. Update `sale_price` there when prices change. `source` and `cost` are never returned by the public inventory API; they only appear in private admin/Telegram order information.
