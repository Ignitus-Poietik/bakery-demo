# Bakery Website Functional Requirements Plan

## 1. Technical and visual direction
- Build the frontend with React and external CSS stylesheets; avoid inline styling for page layout and visual design.
- Structure the frontend as pages composed from focused components; give each page section and reusable visual component its own stylesheet.
- Build the backend API with Django REST Framework (DRF).
- Use a professional bakery-business visual style with a green-and-white palette.
- Use Inter for body text and Stack Sans Headline for headings.
- Build the hero around the bakery's name: on scroll, scale and fade the lettering to reveal a three-layer cake and three short business-story sections.
- Animate the cake layers separating and settling into horizontal bands; keep the sequence reversible on upward scroll and reveal the cake menu after the hero scrolls away.
- Respect reduced-motion preferences with a static hero composition.

## 2. Menu
- Show cakes with name, price in GHS, category, and availability.
- Let customers browse all cakes or filter by category.
- Distinguish bakery-wide closed ordering from individual sold-out cakes.
- Keep unavailable cakes visible with their status, but prevent ordering them.

## 3. Ordering
- Let customers select available cakes and quantities.
- Let customers add an optional note for the bakery to each item in their order.
- Show an order summary with item prices and a total in GHS.
- Allow customers to place orders without creating an account.
- Collect the customer's name (either a full name or first name, optional middle name, and last name), phone number, and delivery location.
- Collect an email address for Paystack checkout; this does not create a customer account.
- Let customers choose a delivery town from a searchable dropdown: typing narrows the available town options, and a town must be selected.
- Collect the delivery address or location details needed to find the customer within the selected town.
- Process website order payments through Paystack and confirm payment before treating an order as paid.
- Keep the Paystack secret key in backend environment configuration; never expose it to the frontend.
- Place orders through the website and confirm successful submission with an order reference.
- Provide a downloadable receipt for each successfully submitted website order.
- Prevent submission when ordering is closed or an item becomes unavailable, and explain why.
- Support the business's configured fulfillment options, such as delivery or pickup.

## 4. Business management
- Add, edit, and remove cakes.
- Manage cake prices, categories, and availability.
- Open or close ordering for the whole business.
- Update business hours, location, and contact details.
- View incoming website orders and update their status.

## 5. Contact and chat
- Provide working phone and WhatsApp contact links.
- Provide a chatbot that answers questions about the business, helps customers resolve issues, and assists them with using the website checkout and submitting an order.
- Keep order selection, order details, submission, and receipt generation in the website ordering flow; the chatbot does not collect or create orders in AI chat.
- Provide a phone or WhatsApp fallback when the chatbot cannot resolve a request.

## 6. Business information and promotions
- Display opening hours, location, phone number, and WhatsApp contact.
- If promotions are included, let customers view and select promotional slides.
- If promotions are managed through the site, let the business update slides and their destination actions.

## 7. Build and verify
1. Define fulfillment options for website orders; integrate Paystack and implement guest checkout with the required customer and delivery details.
2. Define cakes, availability, ordering status, business hours, and contact information.
3. Implement cake browsing and category filters.
4. Implement website ordering, confirmation, and downloadable receipts.
5. Add business management for menu data and incoming website orders.
6. Connect phone, WhatsApp, and the business-help chatbot, including assistance with the website checkout.
7. Verify the reversible scroll-driven hero, reduced-motion fallback, filtering, prices and totals, optional item notes, closed ordering, sold-out items, guest checkout and customer details, searchable town selection, Paystack payment confirmation, order confirmation, receipt download, chatbot checkout assistance without AI-chat order creation, and business updates.
