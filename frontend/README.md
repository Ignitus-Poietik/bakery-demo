# Bakery storefront

The storefront is a React application built with Vite. Its page is composed from focused
components, and component and section styling lives in external CSS files under `src/`.
The hero section is intentionally deferred until its design is provided.

## Run locally

```sh
npm install
npm run dev
```

The Vite development server proxies `/api` requests to Django at
`http://127.0.0.1:8000`. Set `VITE_API_BASE_URL` when the API is hosted elsewhere.

## Validate

```sh
npm run lint
npm run build
```

## Backend and payments

Install the backend dependencies from `../backend/requirements.txt` and run the Django
development server from the `backend` directory. Paystack's public key is configured in
the bakery settings; configure `PAYSTACK_SECRET_KEY` in the backend environment. The
backend verifies transactions directly with Paystack before confirming orders.
