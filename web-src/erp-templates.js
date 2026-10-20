/* ---- v6.44 Business builder: deep templates (Ali: "every business system on the app to have depth") -------------------
   Ten more businesses, each a complete system that works with no model: the tables, links, statuses, formulas, and the
   names the Pro layer (erp-pro.js) reads — so every one starts with stock that moves, customer balances and statements,
   due dates that warn (licences, expiry, renewals, rent), and assets that can't be booked twice. Same spec format as
   erp.js TEMPLATES. Tests: tests/unit/v744templates.test.mjs.                                                          */
import { homeCurrency } from "./locale.js";

const T = (name, fields) => ({ name, fields });
const f = (name, type = "text", x = {}) => ({ name, type, ...x });
const money = (n) => f(n, "money"), num = (n) => f(n, "number"), date = (n) => f(n, "date"), link = (n, to) => f(n, "link", { link: to });
const choice = (n, options) => f(n, "choice", { options }), auto = (n, prefix) => f(n, "auto", { prefix }), calc = (n, formula) => f(n, "formula", { formula });
const req = (n) => f(n, "text", { required: true });
const METHOD = choice("Method", ["Cash", "Card", "Bank transfer", "Wallet", "Cheque"]);
const PAYMENTS = (party, extra = []) => T("Payments", [auto("Receipt no", "RCT-"), link(party.replace(/s$/, ""), party), date("Date"), money("Amount"), METHOD, ...extra, f("Notes", "longtext")]);

export const DEEP_TEMPLATES = [
  { id: "clinic", title: "Clinic & medical centre", blurb: "Patients, doctors, visits, prescriptions, medicines stock, payments", spec: { name: "Clinic", currency: homeCurrency(), tables: [
    T("Patients", [req("Name"), auto("File no", "P-"), f("Phone", "phone"), date("Date of birth"), choice("Gender", ["Male", "Female"]), f("Insurance", "text"), f("Allergies", "longtext"), f("History", "longtext")]),
    T("Doctors", [req("Name"), choice("Specialty", ["General", "Internal medicine", "Paediatrics", "Dentistry", "Dermatology", "Orthopaedics", "Gynaecology", "ENT", "Ophthalmology"]), f("Phone", "phone"), money("Visit fee"), num("Share %")]),
    T("Visits", [auto("Visit no", "V-"), link("Patient", "Patients"), link("Doctor", "Doctors"), date("Date"), f("Time"), choice("Type", ["New", "Follow-up", "Emergency", "Procedure"]), f("Diagnosis", "longtext"), money("Fee"), money("Discount"), calc("Total", "[Fee] - IFEMPTY([Discount], 0)"), money("Paid"), calc("Balance", "[Total] - IFEMPTY([Paid], 0)"), date("Follow-up due"), choice("Status", ["Booked", "Arrived", "Done", "No-show", "Cancelled"])]),
    T("Medicines", [req("Medicine"), f("Form"), num("In stock"), num("Reorder at"), money("Unit cost"), money("Price"), date("Expiry date")]),
    T("Medicine issues", [link("Visit", "Visits"), link("Medicine", "Medicines"), num("Qty"), f("Dose"), f("Days")]),
    T("Medicine purchases", [date("Date"), link("Medicine", "Medicines"), num("Qty"), money("Unit cost"), calc("Total", "[Qty] * [Unit cost]"), f("Supplier")]),
    PAYMENTS("Patients"),
  ] } },
  { id: "academy", title: "Training centre & academy", blurb: "Students, courses, enrolments, sessions, attendance, teachers, payments", spec: { name: "Academy", currency: homeCurrency(), tables: [
    T("Students", [req("Name"), auto("Student no", "S-"), f("Phone", "phone"), f("Parent phone", "phone"), f("School / university"), choice("Level", ["Beginner", "Intermediate", "Advanced"])]),
    T("Teachers", [req("Name"), f("Phone", "phone"), f("Subject"), money("Rate per hour")]),
    T("Courses", [req("Course"), link("Teacher", "Teachers"), num("Hours"), num("Sessions"), money("Fee"), num("Capacity"), date("Starts on"), date("Ends on")]),
    T("Subscriptions", [auto("Enrolment no", "E-"), link("Student", "Students"), link("Course", "Courses"), date("Date"), money("Fee"), money("Discount"), calc("Total", "[Fee] - IFEMPTY([Discount], 0)"), money("Paid"), calc("Balance", "[Total] - IFEMPTY([Paid], 0)"), date("Instalment due"), choice("Status", ["Enrolled", "Waiting list", "Completed", "Dropped"])]),
    T("Sessions", [link("Course", "Courses"), date("Date"), f("Time"), link("Teacher", "Teachers"), num("Hours"), f("Topic")]),
    T("Attendance", [link("Student", "Students"), link("Session", "Sessions"), choice("Present", ["Present", "Absent", "Late", "Excused"]), num("Grade")]),
    PAYMENTS("Students"),
  ] } },
  { id: "property", title: "Property rentals", blurb: "Units, tenants, contracts, monthly rent, payments, maintenance", spec: { name: "Property rentals", currency: homeCurrency(), tables: [
    T("Units", [req("Unit"), f("Building"), choice("Type", ["Apartment", "Shop", "Office", "Villa", "Warehouse"]), num("Area m2"), num("Rooms"), money("Monthly rent"), choice("Status", ["Vacant", "Rented", "Under maintenance"])]),
    T("Tenants", [req("Name"), f("National ID"), f("Phone", "phone"), f("Email", "email"), f("Guarantor"), f("Guarantor phone", "phone")]),
    T("Contracts", [auto("Contract no", "C-"), link("Tenant", "Tenants"), link("Unit", "Units"), date("Start"), date("End"), money("Monthly rent"), num("Yearly increase %"), money("Deposit"), date("Renewal due"), choice("Status", ["Active", "Ended", "Cancelled"])]),
    T("Rent invoices", [auto("Invoice no", "R-"), link("Tenant", "Tenants"), link("Contract", "Contracts"), date("Month"), money("Amount"), money("Utilities"), calc("Total", "[Amount] + IFEMPTY([Utilities], 0)"), money("Paid"), calc("Balance", "[Total] - IFEMPTY([Paid], 0)"), date("Due date"), choice("Status", ["Unpaid", "Partly paid", "Paid"])]),
    PAYMENTS("Tenants"),
    T("Maintenance", [link("Unit", "Units"), date("Date"), f("Issue", "longtext"), money("Cost"), choice("Paid by", ["Owner", "Tenant"]), choice("Status", ["Open", "In progress", "Done"])]),
  ] } },
  { id: "workshop", title: "Car workshop & service centre", blurb: "Customers, cars, job cards, parts stock, parts used, purchases, payments", spec: { name: "Workshop", currency: homeCurrency(), tables: [
    T("Customers", [req("Name"), f("Phone", "phone"), f("Company"), money("Credit limit")]),
    T("Cars", [req("Plate"), link("Customer", "Customers"), f("Make"), f("Model"), num("Year"), f("VIN"), num("Odometer"), date("Next service due"), date("Licence expiry")]),
    T("Parts", [req("Part"), f("Part no"), num("In stock"), num("Reorder at"), money("Unit cost"), money("Price")]),
    T("Jobs", [auto("Job card", "JC-"), link("Car", "Cars"), link("Customer", "Customers"), date("Date in"), date("Date out"), f("Complaint", "longtext"), f("Work done", "longtext"), money("Labour"), money("Parts total"), calc("Total", "IFEMPTY([Labour], 0) + IFEMPTY([Parts total], 0)"), money("Paid"), calc("Balance", "[Total] - IFEMPTY([Paid], 0)"), choice("Status", ["Waiting", "In progress", "Waiting for parts", "Ready", "Delivered"])]),
    T("Parts used", [link("Job", "Jobs"), link("Part", "Parts"), num("Qty"), money("Price"), calc("Line total", "[Qty] * [Price]")]),
    T("Suppliers", [req("Supplier"), f("Phone", "phone")]),
    T("Purchases", [date("Date"), link("Supplier", "Suppliers"), link("Part", "Parts"), num("Qty"), money("Unit cost"), calc("Total", "[Qty] * [Unit cost]")]),
    PAYMENTS("Customers"),
  ] } },
  { id: "gym", title: "Gym & fitness club", blurb: "Members, plans, subscriptions with expiry, classes, attendance, coaches, payments", spec: { name: "Gym", currency: homeCurrency(), tables: [
    T("Members", [req("Name"), auto("Member no", "M-"), f("Phone", "phone"), date("Joined"), choice("Gender", ["Male", "Female"]), num("Weight kg"), f("Goal")]),
    T("Plans", [req("Plan"), num("Months"), money("Price"), num("Classes a week")]),
    T("Coaches", [req("Name"), f("Phone", "phone"), f("Speciality"), money("Rate per class")]),
    T("Subscriptions", [auto("Subscription no", "SUB-"), link("Member", "Members"), link("Plan", "Plans"), date("Start"), date("Expiry date"), money("Price"), money("Discount"), calc("Total", "[Price] - IFEMPTY([Discount], 0)"), money("Paid"), calc("Balance", "[Total] - IFEMPTY([Paid], 0)"), choice("Status", ["Active", "Frozen", "Ended"])]),
    T("Classes", [req("Class"), link("Coach", "Coaches"), choice("Day", ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"]), f("Time"), num("Capacity")]),
    T("Attendance", [link("Member", "Members"), date("Date"), link("Class", "Classes"), f("Check-in time")]),
    PAYMENTS("Members"),
  ] } },
  { id: "salon", title: "Salon & spa", blurb: "Clients, services, staff, bookings, product stock and sales, payments", spec: { name: "Salon", currency: homeCurrency(), tables: [
    T("Clients", [req("Name"), f("Phone", "phone"), date("Birthday"), f("Notes", "longtext")]),
    T("Services", [req("Service"), choice("Category", ["Hair", "Nails", "Skin", "Massage", "Makeup", "Barber"]), num("Minutes"), money("Price")]),
    T("Staff", [req("Name"), f("Phone", "phone"), num("Commission %")]),
    T("Bookings", [auto("Booking no", "B-"), link("Client", "Clients"), link("Service", "Services"), link("Staff member", "Staff"), date("Date"), f("Time"), money("Price"), money("Tip"), calc("Total", "[Price] + IFEMPTY([Tip], 0)"), money("Paid"), calc("Balance", "[Total] - IFEMPTY([Paid], 0)"), choice("Status", ["Booked", "Done", "No-show", "Cancelled"])]),
    T("Products", [req("Product"), num("In stock"), num("Reorder at"), money("Unit cost"), money("Price")]),
    T("Product sales", [date("Date"), link("Client", "Clients"), link("Product", "Products"), num("Qty"), money("Price"), calc("Total", "[Qty] * [Price]")]),
    PAYMENTS("Clients"),
  ] } },
  { id: "pharmacy", title: "Pharmacy", blurb: "Medicines with expiry, stock, suppliers, purchases, sales, customers on credit", spec: { name: "Pharmacy", currency: homeCurrency(), tables: [
    T("Medicines", [req("Medicine"), f("Active ingredient"), f("Barcode"), num("In stock"), num("Reorder at"), money("Unit cost"), money("Price"), date("Expiry date"), f("Shelf")]),
    T("Suppliers", [req("Supplier"), f("Phone", "phone"), f("Rep")]),
    T("Purchases", [auto("Purchase no", "PU-"), date("Date"), link("Supplier", "Suppliers"), link("Medicine", "Medicines"), num("Qty"), money("Unit cost"), calc("Total", "[Qty] * [Unit cost]"), date("Batch expiry")]),
    T("Customers", [req("Name"), f("Phone", "phone"), money("Credit limit")]),
    T("Sales", [auto("Sale no", "SL-"), date("Date"), link("Customer", "Customers"), link("Medicine", "Medicines"), num("Qty"), money("Price"), calc("Total", "[Qty] * [Price]"), choice("Payment", ["Cash", "Card", "On credit"]), f("Prescription no")]),
    PAYMENTS("Customers"),
  ] } },
  { id: "transport", title: "Transport & trucking", blurb: "Customers, trucks, drivers, trip orders, fuel, invoices, payments, licences", spec: { name: "Transport", currency: homeCurrency(), tables: [
    T("Customers", [req("Name"), f("Company"), f("Phone", "phone"), money("Credit limit")]),
    T("Trucks", [req("Plate"), f("Model"), num("Capacity tons"), date("Licence expiry"), date("Insurance expiry"), date("Next service due"), choice("Status", ["Available", "On a trip", "In the workshop"])]),
    T("Drivers", [req("Name"), f("Phone", "phone"), date("Licence expiry"), money("Trip allowance")]),
    T("Trip orders", [auto("Trip no", "T-"), link("Customer", "Customers"), link("Truck", "Trucks"), link("Driver", "Drivers"), f("From"), f("To"), date("Start"), date("End"), num("Weight tons"), num("Km"), money("Price"), calc("Price per km", "ROUND([Price] / [Km], 2)"), choice("Status", ["Planned", "On the road", "Delivered", "Cancelled"])]),
    T("Fuel", [link("Truck", "Trucks"), date("Date"), num("Litres"), money("Cost"), num("Odometer")]),
    T("Invoices", [auto("Invoice no", "INV-"), link("Customer", "Customers"), link("Trip", "Trip orders"), date("Date"), money("Amount"), money("Paid"), calc("Balance", "[Amount] - IFEMPTY([Paid], 0)"), date("Due date"), choice("Status", ["Unpaid", "Partly paid", "Paid"])]),
    PAYMENTS("Customers"),
  ] } },
  { id: "contractor", title: "Construction contractor", blurb: "Clients, projects, quotes, progress invoices with retention, materials stock, subcontractors, expenses", spec: { name: "Contracting", currency: homeCurrency(), tables: [
    T("Clients", [req("Client"), f("Contact"), f("Phone", "phone"), f("Tax no")]),
    T("Projects", [req("Project"), link("Client", "Clients"), f("Site"), date("Start"), date("Deadline"), money("Contract value"), num("Progress %"), choice("Status", ["Tender", "Running", "On hold", "Handed over", "Closed"])]),
    T("Quotes", [auto("Quote no", "Q-"), link("Project", "Projects"), date("Date"), money("Amount"), date("Valid until"), choice("Status", ["Sent", "Accepted", "Rejected", "Expired"])]),
    T("Invoices", [auto("Invoice no", "INV-"), link("Client", "Clients"), link("Project", "Projects"), date("Date"), money("Amount"), num("Retention %"), calc("Retention", "ROUND([Amount] * IFEMPTY([Retention %], 0) / 100, 2)"), calc("Net", "[Amount] - [Retention]"), money("Paid"), calc("Balance", "[Net] - IFEMPTY([Paid], 0)"), date("Due date"), choice("Status", ["Unpaid", "Partly paid", "Paid"])]),
    PAYMENTS("Clients"),
    T("Materials", [req("Material"), f("Unit"), num("In stock"), num("Reorder at"), money("Unit cost")]),
    T("Material purchases", [date("Date"), link("Material", "Materials"), num("Qty"), money("Unit cost"), calc("Total", "[Qty] * [Unit cost]"), f("Supplier")]),
    T("Material issues", [date("Date"), link("Material", "Materials"), link("Project", "Projects"), num("Qty")]),
    T("Expenses", [date("Date"), link("Project", "Projects"), choice("Category", ["Labour", "Subcontractor", "Equipment hire", "Transport", "Permits", "Other"]), f("What"), money("Amount")]),
  ] } },
  { id: "wholesale", title: "Wholesale & distribution", blurb: "Products, customers with credit limits, orders, deliveries, purchases, returns, payments", spec: { name: "Wholesale", currency: homeCurrency(), tables: [
    T("Products", [req("Product"), auto("SKU", "P-"), f("Unit"), num("In stock"), num("Reorder at"), money("Unit cost"), money("Wholesale price"), money("Retail price")]),
    T("Customers", [req("Name"), f("Shop"), f("Area"), f("Phone", "phone"), money("Credit limit"), choice("Price list", ["Wholesale", "Retail", "Special"])]),
    T("Sales orders", [auto("Order no", "SO-"), date("Date"), link("Customer", "Customers"), link("Product", "Products"), num("Qty"), money("Price"), calc("Total", "[Qty] * [Price]"), choice("Payment", ["Cash", "On credit"]), date("Due date"), choice("Status", ["New", "Packed", "Delivered", "Cancelled"])]),
    T("Suppliers", [req("Supplier"), f("Phone", "phone")]),
    T("Purchases", [date("Date"), link("Supplier", "Suppliers"), link("Product", "Products"), num("Qty"), money("Unit cost"), calc("Total", "[Qty] * [Unit cost]")]),
    T("Returns received", [date("Date"), link("Customer", "Customers"), link("Product", "Products"), num("Qty"), f("Reason")]),
    PAYMENTS("Customers"),
  ] } },
];

/** Words in a description → the deep template that fits (with erp.js guessTemplate for the older ones). */
export const DEEP_WORDS = {
  clinic: /(clinic|doctor|patient|medical|dental|dentist|عيادة|دكتور|مريض|طبي|أسنان|اسنان)/g,
  academy: /(academy|training|course|student|school|lesson|tutor|سنتر|أكاديمية|اكاديمية|كورس|طالب|طلبة|مدرسة|دروس|تدريب)/g,
  property: /(property|tenant|landlord|apartment|lease|real estate|عقار|عقارات|مستأجر|شقة|شقق|إيجار شهري)/g,
  workshop: /(workshop|garage|mechanic|car repair|service centre|ورشة|ميكانيكي|صيانة عربيات|مركز صيانة)/g,
  gym: /(gym|fitness|member|membership|coach|جيم|نادي|اشتراك|كابتن|لياقة)/g,
  salon: /(salon|spa|barber|beauty|hair|nails|كوافير|صالون|سبا|حلاق|تجميل)/g,
  pharmacy: /(pharmacy|chemist|medicine|drug|صيدلية|أدوية|ادوية|دواء)/g,
  transport: /(transport|truck|trucking|logistics|trip|freight|delivery fleet|نقل|شحن|تريلا|عربيات نقل|رحلة|لوجستي)/g,
  contractor: /(construction|contractor|building|site works|retention|مقاولات|مقاول|إنشاءات|انشاءات|تشطيب)/g,
  wholesale: /(wholesale|distribut|distributor|جملة|توزيع|موزع)/g,
};
