# Mikye Media — Social Handle Marketplace

Serverless marketplace for curated Instagram, TikTok, X/Twitter, and Snapchat handles.

## What this build does
- Live multi-platform inventory with search, 2L/3L/4L/word filters, sorting, and load-more pagination.
- Manual checkout for Cash App, Zelle, PayPal, or crypto.
- Customers submit sender + transaction/reference details after sending payment.
- A selected handle is reserved for 30 minutes while payment is checked.
- Telegram alerts include the private supplier, acquisition cost, public sale price, gross spread, payment details, and buyer email.
- `/admin.html` lets the seller load an order, independently verify payment, fulfill by email, or release the reservation.
- Resend handles fulfillment email delivery.
- Customers can track pending / fulfilled / cancelled status by order ID.

## Hosting
GitHub repo → Vercel → Supabase.

Vercel is used instead of GitHub Pages because `/api/*` server functions keep secrets out of browser JavaScript.

## Security
- Never put `SUPABASE_SERVICE_ROLE_KEY`, `TELEGRAM_BOT_TOKEN`, `RESEND_API_KEY`, or `ADMIN_SECRET` in public HTML/JS.
- Supplier names, acquisition costs, and private inventory imports are intentionally not seeded in this public repository.
- `supabase-setup.sql` is schema-only. Private inventory is imported directly into Supabase with a separate private migration.
- Prefer a private GitHub repository for production.

## Payments
The current Cash App, Zelle, PayPal, and crypto flow is manually verified. A customer typing a reference ID does not mark an order paid.

## Inventory
The public API returns only `id`, `handle`, `platform`, `kind`, and `sale_price`. Supplier and cost fields are only used server-side for admin and Telegram fulfillment.
