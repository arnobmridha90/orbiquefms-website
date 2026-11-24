/* Generated from the reference inventory, section 22: 23 sections, 128 permission codes.
   Each section: id, name, menu (page address in the reference), desc, codes [code, name, description, money(1/0)]. */
var PERM_SECTIONS = [
{
"id": "dashboard",
"name": "Dashboard",
"menu": "/dashboard",
"desc": "The first page: what is happening today, what needs attention, and busy-ness figures for any period. Income, expenses and per-car figures each need their own right below.",
"codes": [
[
"dashboard.view",
"See this section",
"Open the Dashboard. Each block on it also follows the person's rights elsewhere (Bookings, Cars, Maintenance).",
0
],
[
"dashboard.see_revenue",
"See revenue",
"See income figures and charts, month by month and for any period, and money received.",
1
],
[
"dashboard.see_profit",
"See expenses and profit",
"See expenses (service and repair costs, renewed papers, and everything recorded on the Expenses page) and the net result after them.",
1
],
[
"dashboard.see_vehicle_performance",
"See vehicle performance",
"See how much each car earns (and costs, together with See expenses and profit), month by month.",
1
]
]
},
{
"id": "bookings",
"name": "Bookings",
"menu": "/bookings",
"desc": "Rental bookings, their status and the documents customers submit.",
"codes": [
[
"bookings.view",
"See this section",
"Open the bookings list and booking details.",
0
],
[
"bookings.create",
"Create bookings",
"Add a new booking.",
0
],
[
"bookings.edit",
"Edit bookings",
"Change booking details.",
0
],
[
"bookings.edit_amounts",
"Edit amounts",
"Change rates, charges, discounts and payment details.",
1
],
[
"bookings.change_status",
"Change status",
"Move a booking to another status.",
0
],
[
"bookings.delete",
"Delete bookings",
"Permanently delete a booking.",
0
],
[
"bookings.export",
"Export bookings",
"Download booking data as a file.",
0
],
[
"bookings.view_documents",
"See customer documents",
"Open ID, licence and other documents customers uploaded.",
0
],
[
"bookings.see_amounts",
"See amounts",
"See rates, charges, deposits and totals.",
1
],
[
"bookings.manage_locations",
"Manage our locations",
"Add, rename and remove our pick-up and drop-off locations (Settings), which the booking form offers.",
0
]
]
},
{
"id": "customers",
"name": "Customers",
"menu": "/customers",
"desc": "The customer list built from bookings, and the blacklist.",
"codes": [
[
"customers.view",
"See this section",
"Open the customer list.",
0
],
[
"customers.edit",
"Edit customers",
"Change customer details.",
0
],
[
"customers.view_documents",
"See customer documents",
"Open ID and licence scans.",
0
],
[
"customers.check_ic",
"Check customer IC",
"Read a customer's IC picture, check the number and name, and look the customer up on the outside IC check sites. Every check is written to the activity log.",
0
],
[
"customers.blacklist_view",
"See the blacklist",
"See customers who must not be rented to.",
0
],
[
"customers.blacklist_edit",
"Change the blacklist",
"Add or remove blacklisted customers.",
0
]
]
},
{
"id": "inspections",
"name": "Vehicle inspections",
"menu": "",
"desc": "Photos and notes taken when a car is handed over and returned.",
"codes": [
[
"inspections.view",
"See this section",
"Open inspection records.",
0
],
[
"inspections.create",
"Create inspections",
"Add an inspection.",
0
],
[
"inspections.edit",
"Edit inspections",
"Change an inspection.",
0
],
[
"inspections.delete",
"Delete inspections",
"Permanently delete an inspection.",
0
],
[
"inspections.view_photos",
"See photos",
"Open inspection photos.",
0
]
]
},
{
"id": "cars",
"name": "Cars",
"menu": "/cars",
"desc": "The fleet: car details, photos and rental prices shown on the website.",
"codes": [
[
"cars.view",
"See this section",
"Open the car list.",
0
],
[
"cars.create",
"Add cars",
"Add a car to the fleet.",
0
],
[
"cars.edit",
"Edit cars",
"Change car details.",
0
],
[
"cars.delete",
"Delete cars",
"Permanently delete a car.",
0
],
[
"cars.manage_gallery",
"Manage photos",
"Add and remove car gallery photos.",
0
],
[
"cars.see_owner_details",
"See the owner's name and mobile",
"See who owns the car and the owner's mobile number. Without this the owner's name and mobile are hidden on the car pages and in the activity log, and cannot be changed.",
0
],
[
"cars.see_instalment",
"See the car instalment",
"See the monthly instalment amount and the day it is due, on the car, on the Instalments page, on the Dashboard and in the activity log. Without this those figures are hidden everywhere and cannot be changed, and the Instalments page is closed.",
1
],
[
"cars.view_owner_docs",
"See owner documents",
"Open the car owner's IC, driving licence and agreement. Every time one is opened it is written to the activity log.",
0
],
[
"cars.manage_owner_docs",
"Manage owner documents",
"Upload, replace and remove the car owner's IC, driving licence and agreement.",
0
]
]
},
{
"id": "damage_packages",
"name": "Damage packages",
"menu": "/damage-packages",
"desc": "Damage cover options offered with a booking.",
"codes": [
[
"damage_packages.view",
"See this section",
"Open the damage packages.",
0
],
[
"damage_packages.create",
"Add packages",
"Add a damage package.",
0
],
[
"damage_packages.edit",
"Edit packages",
"Change a damage package.",
0
],
[
"damage_packages.delete",
"Delete packages",
"Permanently delete a damage package.",
0
]
]
},
{
"id": "signatures",
"name": "Signatures",
"menu": "/signatures",
"desc": "Company signatures that are placed on rental agreements.",
"codes": [
[
"signatures.view",
"See this section",
"Open the signatures.",
0
],
[
"signatures.create",
"Add signatures",
"Add a signature.",
0
],
[
"signatures.edit",
"Edit signatures",
"Change a signature.",
0
],
[
"signatures.delete",
"Delete signatures",
"Permanently delete a signature.",
0
],
[
"signatures.use_on_booking",
"Use on bookings",
"Pick a signature for a rental agreement.",
0
]
]
},
{
"id": "calendar",
"name": "Calendar & availability",
"menu": "/apps/calendar",
"desc": "The calendar, the availability checker and the schedules page.",
"codes": [
[
"calendar.view",
"See this section",
"Open the calendar, availability and schedules.",
0
],
[
"calendar.see_amounts",
"See amounts",
"See rental amounts on the calendar.",
1
]
]
},
{
"id": "reports",
"name": "Reports",
"menu": "/reports",
"desc": "Downloadable reports, such as bookings and income in Excel.",
"codes": [
[
"reports.view",
"See this section",
"Open the Reports page and preview how many bookings a report covers.",
0
],
[
"reports.see_amounts",
"See amounts",
"See income figures in a report's preview.",
1
],
[
"reports.export_excel",
"Download Excel reports",
"Download a report as an Excel file. The file contains every amount.",
1
]
]
},
{
"id": "faqs",
"name": "FAQs",
"menu": "/faqs",
"desc": "Questions and answers shown on the public website.",
"codes": [
[
"faqs.view",
"See this section",
"Open the FAQ list.",
0
],
[
"faqs.create",
"Add FAQs",
"Add a question.",
0
],
[
"faqs.edit",
"Edit FAQs",
"Change a question or answer.",
0
],
[
"faqs.delete",
"Delete FAQs",
"Permanently delete a question.",
0
]
]
},
{
"id": "reviews",
"name": "Reviews",
"menu": "/reviews",
"desc": "Customer reviews shown on the public website.",
"codes": [
[
"reviews.view",
"See this section",
"Open the review list.",
0
],
[
"reviews.create",
"Add reviews",
"Add a review.",
0
],
[
"reviews.edit",
"Edit reviews",
"Change a review.",
0
],
[
"reviews.delete",
"Delete reviews",
"Permanently delete a review.",
0
]
]
},
{
"id": "home_settings",
"name": "Website settings",
"menu": "/home-settings",
"desc": "Home page settings, brand logos and social buttons on the public website.",
"codes": [
[
"home_settings.view",
"See this section",
"Open the website settings.",
0
],
[
"home_settings.edit",
"Edit settings",
"Change settings, brand logos and social buttons.",
0
]
]
},
{
"id": "employees",
"name": "Employees",
"menu": "/employees",
"desc": "Field staff who deliver and collect cars, with their contact details and documents.",
"codes": [
[
"employees.view",
"See this section",
"Open the employee list.",
0
],
[
"employees.create",
"Add employees",
"Add an employee.",
0
],
[
"employees.edit",
"Edit employees",
"Change employee details.",
0
],
[
"employees.delete",
"Delete employees",
"Permanently delete an employee.",
0
],
[
"employees.view_documents",
"See employee documents",
"Open ID and proof of address scans.",
0
]
]
},
{
"id": "tasks",
"name": "Tasks",
"menu": "/tasks",
"desc": "Jobs such as deliveries and returns that are given to field staff.",
"codes": [
[
"tasks.view",
"See this section",
"Open the task list.",
0
],
[
"tasks.create",
"Create tasks",
"Add a task.",
0
],
[
"tasks.edit",
"Edit tasks",
"Change a task, its photos and voice notes.",
0
],
[
"tasks.delete",
"Delete tasks",
"Permanently delete a task.",
0
],
[
"tasks.assign",
"Assign staff",
"Choose which employees do a task.",
0
],
[
"tasks.send_whatsapp",
"Send WhatsApp messages",
"Send or resend task messages to employees.",
0
]
]
},
{
"id": "maintenance",
"name": "Maintenance",
"menu": "/maintenance",
"desc": "Services, repairs, road tax and other papers for each car, with costs, invoices and workshop time.",
"codes": [
[
"maintenance.view",
"See this section",
"Open the maintenance records.",
0
],
[
"maintenance.create",
"Add records",
"Add a maintenance record.",
0
],
[
"maintenance.edit",
"Edit records",
"Change a maintenance record.",
0
],
[
"maintenance.delete",
"Delete records",
"Permanently delete a maintenance record.",
0
],
[
"maintenance.see_costs",
"See costs",
"See what each repair or service cost.",
1
],
[
"maintenance.manage_files",
"Manage invoices and files",
"Upload and remove invoices and other files.",
0
],
[
"maintenance.export",
"Export records",
"Download maintenance data as an Excel file (also needs See costs).",
0
],
[
"maintenance.manage_vendors",
"Manage workshops",
"Add, change and remove workshops and suppliers.",
0
],
[
"maintenance.manage_schedules",
"Manage service reminders",
"Set how often each car needs each service, and edit the list of service types.",
0
],
[
"maintenance.manage_documents",
"Manage road tax and papers",
"Add and renew road tax, insurance, PUSPAKOM, permits and other papers.",
0
],
[
"maintenance.manage_downtime",
"Manage workshop time",
"Remove workshop periods, and block a car for the workshop even when rentals clash.",
0
]
]
},
{
"id": "users",
"name": "Team & access",
"menu": "/team",
"desc": "Staff logins, what each person is allowed to do, and how the menu is arranged.",
"codes": [
[
"users.view",
"See this section",
"See the list of staff and their roles.",
0
],
[
"users.create",
"Add staff",
"Create a new staff login.",
0
],
[
"users.edit",
"Edit staff",
"Change a staff member's details and permissions.",
0
],
[
"users.deactivate",
"Switch logins on or off",
"Stop or allow a staff member from signing in.",
0
],
[
"users.reset_password",
"Reset passwords",
"Set a new password for a staff member.",
0
],
[
"users.manage_roles",
"Manage roles",
"Create and change roles.",
0
],
[
"users.manage_menu",
"Arrange the menu",
"Choose which menu group each feature sits under, for everyone.",
0
],
[
"users.view_audit",
"See the activity log",
"See who changed what and when.",
0
]
]
},
{
"id": "billing",
"name": "Invoices & receipts",
"menu": "/invoices",
"desc": "Invoices and payment receipts for bookings, sending them to customers, and the company details printed on them.",
"codes": [
[
"billing.view",
"See this section",
"Open invoices, receipts and payments, and download or preview them. Every amount on them is visible, and so are the payment slips (bank slip pictures) kept with payments.",
1
],
[
"billing.issue_invoice",
"Issue invoices",
"Create an invoice from a booking.",
0
],
[
"billing.issue_receipt",
"Issue receipts",
"Create or re-issue a receipt for a payment.",
0
],
[
"billing.record_payment",
"Record payments",
"Record money received from a customer, including by uploading the payment slip, and add a slip to a payment that is already recorded.",
1
],
[
"billing.manage_cash",
"Cash held by staff",
"See how much cash each member of staff is holding that has not been banked, and tick it off once it is paid into the bank.",
1
],
[
"billing.send",
"Send to customers",
"Send an invoice or receipt by WhatsApp or email, or get a link to share.",
0
],
[
"billing.void",
"Void documents",
"Cancel an invoice, a receipt or a payment that was entered by mistake.",
0
],
[
"billing.settings",
"Company details",
"Change the company name, address, bank details, logo and numbering printed on documents.",
0
]
]
},
{
"id": "summons",
"name": "Summons",
"menu": "/summons",
"desc": "Record PDRM and JPJ summons, tie each one to the booking that had the car at that moment, and charge that customer.",
"codes": [
[
"summons.view",
"See this section",
"Open the list of summons and see the fine amounts.",
1
],
[
"summons.add",
"Add summons",
"Type in a new summons by hand.",
0
],
[
"summons.upload",
"Upload summons pictures",
"Add summons by uploading photos or scans of the notices; the details are read from the picture. Without this, the Upload button is hidden and uploads are refused.",
0
],
[
"summons.edit",
"Change summons",
"Correct the details of a summons, choose which booking it belongs to, and confirm details read from a picture.",
0
],
[
"summons.import",
"Import a list",
"Paste rows or upload a CSV file to add many summons at once.",
0
],
[
"summons.charge",
"Charge the customer",
"Decide the amount to ask from the customer and send them the message.",
1
],
[
"summons.record_payment",
"Record payment",
"Mark a summons as paid by the customer; this also records the payment and its receipt.",
1
],
[
"summons.waive",
"Waive or dispute",
"Drop the charge, mark it as disputed, or open it again.",
0
],
[
"summons.delete",
"Delete summons",
"Remove a summons that was added by mistake.",
0
]
]
},
{
"id": "deposits",
"name": "Deposit refunds",
"menu": "/deposits",
"desc": "Security deposits waiting to be given back after a rental: what to keep for damage, fuel or fines, what to return, and the statement for the customer.",
"codes": [
[
"deposits.view",
"See this section",
"Open the deposit list and each deposit's details and statement. Every amount is visible.",
1
],
[
"deposits.edit_deductions",
"Enter deductions",
"Write down what is kept from a deposit (damage, fuel, cleaning, fines, late fee, other).",
1
],
[
"deposits.refund",
"Record refunds",
"Record that the rest of a deposit was given back to the customer.",
1
],
[
"deposits.send",
"Send statements",
"Send the deposit statement to the customer by WhatsApp, or download it.",
0
],
[
"deposits.reopen",
"Reopen a refund",
"Undo a recorded refund that was entered by mistake so it can be corrected.",
0
]
]
},
{
"id": "customer_notes",
"name": "Customer notes",
"menu": "/customers",
"desc": "Notes and warnings about a customer (VIP, be careful, general info) that show up whenever the same person books again.",
"codes": [
[
"customer_notes.view",
"See this section",
"See notes, warnings and the rental history summary of a customer.",
0
],
[
"customer_notes.add",
"Add notes",
"Write a new note about a customer.",
0
],
[
"customer_notes.edit",
"Edit notes",
"Change or pin a note.",
0
],
[
"customer_notes.delete",
"Delete notes",
"Permanently delete a note.",
0
]
]
},
{
"id": "expenses",
"name": "Expenses",
"menu": "/expenses",
"desc": "Money the business spends: fuel, tolls, e-hailing fares, car wash, rent, insurance, repairs, salaries and anything else, each with its date and an optional receipt photo.",
"codes": [
[
"expenses.view",
"See this section",
"Open the Expenses page. Without \"See everyone's expenses\" a person sees only the entries they recorded themselves.",
0
],
[
"expenses.add",
"Record everyday expenses",
"Record fuel, tolls, parking, Grab or Bolt fares, car wash and other everyday costs.",
0
],
[
"expenses.add_business",
"Record business expenses",
"Record rent, salaries, insurance, road tax, repairs, police reports, SIM recharge and every other office or admin cost.",
0
],
[
"expenses.edit_own",
"Change or delete your own entries",
"Fix or remove an entry you recorded yourself, within 24 hours of recording it.",
0
],
[
"expenses.view_all",
"See everyone's expenses",
"See every entry from every person, and the company totals by month, category and car.",
1
],
[
"expenses.edit_all",
"Change or delete anyone's entries",
"Fix or remove any entry, at any time. Every change is kept in the activity log.",
1
],
[
"expenses.manage_categories",
"Manage expense categories",
"Add, rename, hide and organise the kinds of expense people can choose from.",
0
],
[
"expenses.export",
"Download to Excel",
"Download the expense list as an Excel file.",
1
]
]
},
{
"id": "tracking",
"name": "Tracking",
"menu": "/tracking",
"desc": "Where each car is now, its trips and alarms, from the GPS trackers on the Tracksolid platform.",
"codes": [
[
"tracking.view",
"See this section",
"See where the cars are now: state, speed and last position.",
0
],
[
"tracking.history",
"See trip history",
"Look at where a car went on a given day.",
0
],
[
"tracking.alarms",
"See alarms",
"See the alarms the trackers raised (over-speed, power cut, SOS and so on).",
0
],
[
"tracking.manage_accounts",
"Manage tracker accounts",
"Connect, change and test the Tracksolid accounts, and link a tracker to a car by hand.",
0
]
]
},
{
"id": "ic_check",
"name": "IC check accounts",
"menu": "/settings/ic-check",
"desc": "The logins of the outside sites used to check a customer's IC. Owner only by default.",
"codes": [
[
"ic_check.view",
"See this section",
"Open the IC check accounts screen.",
0
],
[
"ic_check.manage_accounts",
"Manage IC check accounts",
"Save, replace and switch off the logins used for the online IC checks. Passwords are never shown again.",
0
]
]
}
];
var PERM_CODES = []; PERM_SECTIONS.forEach(function (s) { s.money = s.codes.some(function (c) { return c[3]; }); s.codes.forEach(function (c) { PERM_CODES.push(c[0]); }); });
