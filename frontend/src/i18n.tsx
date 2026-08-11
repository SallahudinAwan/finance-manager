import {
  createContext,
  type ReactNode,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";

export type AppLanguage = "en" | "ur";

const urduMessages: Record<string, string> = {
  "This month": "یہ مہینہ",
  "Savings": "بچت",
  "Notifications": "اطلاعات",
  "Settings": "ترتیبات",
  "Account": "اکاؤنٹ",
  "Household owner": "گھرانے کا مالک",
  "Household member": "گھرانے کا رکن",
  "Sign out": "سائن آؤٹ",
  "Close menu": "مینو بند کریں",
  "Close navigation": "نیویگیشن بند کریں",
  "Open menu": "مینو کھولیں",
  "Expand navigation": "نیویگیشن پھیلائیں",
  "Collapse navigation": "نیویگیشن سمیٹیں",
  "Toggle color theme": "رنگوں کی تھیم تبدیل کریں",
  "Primary navigation": "مرکزی نیویگیشن",
  "English": "انگریزی",
  "Urdu": "اردو",
  "Language": "زبان",
  "Change language": "زبان تبدیل کریں",
  "Your month, in one clear flow": "آپ کا مہینہ، ایک واضح روانی میں",
  "Loading this month’s plan…": "اس مہینے کا منصوبہ لوڈ ہو رہا ہے…",
  "Overview": "جائزہ",
  "No active month yet": "ابھی کوئی فعال مہینہ نہیں",
  "Your overview will appear as soon as you add or restore a monthly workspace.":
    "جیسے ہی آپ ماہانہ ورک اسپیس شامل یا بحال کریں گے، آپ کا جائزہ یہاں نظر آئے گا۔",
  "Start with a month": "ایک مہینے سے آغاز کریں",
  "Create a month to track income, household bills, personal spending, savings, and bank activity.":
    "آمدنی، گھریلو بل، ذاتی اخراجات، بچت اور بینک سرگرمی جانچنے کے لیے ایک مہینہ بنائیں۔",
  "A clear view of what is safe to spend, what is reserved, and what is actually in the bank.":
    "جو رقم خرچ کی جا سکتی ہے، جو محفوظ ہے اور جو واقعی بینک میں ہے—سب کا واضح جائزہ۔",
  "Safe to spend": "خرچ کے لیے محفوظ",
  "After planned bills and savings": "منصوبہ شدہ بلوں اور بچت کے بعد",
  "Calculated bank": "حساب شدہ بینک بیلنس",
  "Opening balance plus recorded cash flow": "ابتدائی بیلنس اور ریکارڈ شدہ کیش فلو",
  "House balance": "گھریلو بقایا",
  "Savings reserved": "محفوظ بچت",
  "Your bank needs reconciliation": "آپ کے بینک بیلنس کی تصدیق درکار ہے",
  "Review": "جائزہ لیں",
  "Cash flow": "کیش فلو",
  "Income versus spending": "آمدنی بمقابلہ اخراجات",
  "Full report": "مکمل رپورٹ",
  "Your trend begins here": "آپ کا رجحان یہاں سے شروع ہوتا ہے",
  "Record income and payments to build a useful month-over-month picture.":
    "ماہ بہ ماہ مفید تصویر بنانے کے لیے آمدنی اور ادائیگیاں ریکارڈ کریں۔",
  "Savings target": "بچت کا ہدف",
  "No target set": "کوئی ہدف مقرر نہیں",
  "Household plan": "گھریلو منصوبہ",
  "Bills still waiting": "باقی بل",
  "Everything is covered": "سب ادائیگیاں مکمل ہیں",
  "There are no unpaid household bills in this month.": "اس مہینے کوئی غیر ادا شدہ گھریلو بل نہیں۔",
  "Monthly workspace": "ماہانہ ورک اسپیس",
  "No active months": "کوئی فعال مہینہ نہیں",
  "Deleted months stay hidden until you explicitly create them again.":
    "حذف شدہ مہینے تب تک پوشیدہ رہتے ہیں جب تک آپ انہیں دوبارہ نہ بنائیں۔",
  "Add a month": "مہینہ شامل کریں",
  "Create a fresh monthly workspace from your recurring plan.":
    "اپنے مستقل منصوبے سے نئی ماہانہ ورک اسپیس بنائیں۔",
  "Your month list is empty": "آپ کی مہینوں کی فہرست خالی ہے",
  "Use Add month when you are ready to start a new or previously deleted monthly workspace.":
    "نیا یا پہلے حذف شدہ مہینہ شروع کرنے کے لیے ’مہینہ شامل کریں‘ استعمال کریں۔",
  "Track what was planned and record only what actually moved through your bank.":
    "منصوبہ شدہ رقم دیکھیں اور صرف وہی ریکارڈ کریں جو حقیقت میں بینک سے منتقل ہوئی۔",
  "Choose month": "مہینہ منتخب کریں",
  "Add a previous month": "پچھلا مہینہ شامل کریں",
  "Create a monthly workspace from your recurring plan, then enter its complete historical flow.":
    "اپنے مستقل منصوبے سے ماہانہ ورک اسپیس بنائیں، پھر اس کا مکمل سابقہ مالی بہاؤ درج کریں۔",
  "Delete month": "مہینہ حذف کریں",
  "This removes the complete financial flow for this month and cannot be undone.":
    "یہ اس مہینے کا مکمل مالی بہاؤ حذف کر دے گا اور اسے واپس نہیں لایا جا سکتا۔",
  "Add a private expense": "ذاتی خرچ شامل کریں",
  "Only you can see the entry details. The household sees an anonymous combined total.":
    "صرف آپ تفصیل دیکھ سکتے ہیں۔ گھرانے کو صرف مجموعی رقم نظر آتی ہے۔",
  "Reserved before personal spending": "ذاتی خرچ سے پہلے محفوظ",
  "Reserved automatically when income is received": "آمدنی وصول ہونے پر خودکار طور پر محفوظ",
  "Money in": "آمدنی",
  "Income": "آمدنی",
  "Planned obligations": "منصوبہ شدہ واجبات",
  "Household expenses": "گھریلو اخراجات",
  "Expense": "خرچ",
  "Due": "آخری تاریخ",
  "Expected": "متوقع",
  "Paid": "ادا شدہ",
  "Unpaid": "بقایا",
  "Status": "حالت",
  "Actual bank movements": "حقیقی بینک لین دین",
  "Shared transactions": "مشترکہ لین دین",
  "Income, bill payments, and reconciliation adjustments":
    "آمدنی، بلوں کی ادائیگیاں اور بیلنس کی ایڈجسٹمنٹ",
  "Transaction": "لین دین",
  "Type": "قسم",
  "Date": "تاریخ",
  "Amount": "رقم",
  "No shared transactions yet": "ابھی کوئی مشترکہ لین دین نہیں",
  "Received income and household payments will appear here.":
    "وصول شدہ آمدنی اور گھریلو ادائیگیاں یہاں نظر آئیں گی۔",
  "Private by design": "پرائیویسی بنیادی اصول",
  "Your personal expenses": "آپ کے ذاتی اخراجات",
  "No personal spending yet": "ابھی کوئی ذاتی خرچ نہیں",
  "Add an expense when it happens; details remain private to your account.":
    "خرچ ہوتے ہی شامل کریں؛ تفصیل صرف آپ کے اکاؤنٹ تک محدود رہے گی۔",
  "Record a household payment": "گھریلو ادائیگی ریکارڈ کریں",
  "Partial payments are supported and the remaining balance updates automatically.":
    "جزوی ادائیگی ممکن ہے اور باقی رقم خودکار طور پر اپ ڈیٹ ہوگی۔",
  "Payment amount": "ادائیگی کی رقم",
  "Payment details": "ادائیگی کی تفصیل",
  "You are paying": "آپ یہ ادائیگی کر رہے ہیں",
  "Expected total": "کل متوقع رقم",
  "Paid so far": "اب تک ادا شدہ",
  "Remaining to pay": "باقی قابلِ ادائیگی",
  "Enter the amount you are paying now. You can pay the full remaining balance or record a partial payment.":
    "اب ادا کی جانے والی رقم درج کریں۔ آپ مکمل بقایا یا جزوی ادائیگی ریکارڈ کر سکتے ہیں۔",
  "Edit shared transaction": "مشترکہ لین دین میں ترمیم",
  "Correct the amount, date, or notes without changing what kind of transaction it is.":
    "لین دین کی قسم بدلے بغیر رقم، تاریخ یا نوٹس درست کریں۔",
  "Edit private expense": "ذاتی خرچ میں ترمیم",
  "Only you can see these details.": "صرف آپ یہ تفصیل دیکھ سکتے ہیں۔",
  "Delete transaction?": "لین دین حذف کریں؟",
  "This permanently removes the transaction and immediately recalculates every affected balance.":
    "یہ لین دین مستقل طور پر حذف ہوگا اور تمام متعلقہ بیلنس فوراً دوبارہ حساب ہوں گے۔",
  "Record received income": "وصول شدہ آمدنی ریکارڈ کریں",
  "Confirm the receiving date and reserve this month’s fixed savings.":
    "وصولی کی تاریخ کی تصدیق کریں اور اس مہینے کی مقررہ بچت محفوظ کریں۔",
  "Income receipt details": "آمدنی کی وصولی کی تفصیل",
  "You are receiving": "آپ وصول کر رہے ہیں",
  "Date received": "وصولی کی تاریخ",
  "Savings goal for fixed monthly savings": "مقررہ ماہانہ بچت کا ہدف",
  "Create or reactivate a savings goal before receiving this income.":
    "یہ آمدنی وصول کرنے سے پہلے بچت کا ہدف بنائیں یا دوبارہ فعال کریں۔",
  "Could not record this income. Check the date and try again.":
    "یہ آمدنی ریکارڈ نہیں ہو سکی۔ تاریخ چیک کر کے دوبارہ کوشش کریں۔",
  "Receiving…": "وصول کیا جا رہا ہے…",
  "Record the actual amount that reached your bank.": "وہ اصل رقم درج کریں جو آپ کے بینک میں پہنچی۔",
  "Amount received": "وصول شدہ رقم",
  "Create monthly workspace": "ماہانہ ورک اسپیس بنائیں",
  "Creating…": "بنایا جا رہا ہے…",
  "This deletes:": "یہ حذف کرے گا:",
  "All income and shared bank transactions recorded in this month":
    "اس مہینے کی تمام آمدنی اور مشترکہ بینک لین دین",
  "Every member’s private expenses for this month": "اس مہینے کے ہر رکن کے ذاتی اخراجات",
  "Savings movements and bank reconciliations dated in this month":
    "اس مہینے کی بچت کی منتقلیاں اور بینک تصدیقات",
  "The month’s income and household-expense plan snapshots":
    "اس مہینے کی آمدنی اور گھریلو اخراجات کے منصوبے",
  "Your recurring templates and savings goals will remain unchanged.":
    "آپ کے مستقل ٹیمپلیٹس اور بچت کے اہداف تبدیل نہیں ہوں گے۔",
  "Cancel": "منسوخ کریں",
  "Delete complete month": "مکمل مہینہ حذف کریں",
  "Deleting…": "حذف ہو رہا ہے…",
  "Delete permanently": "مستقل حذف کریں",
  "Household payment": "گھریلو ادائیگی",
  "Adjustment": "ایڈجسٹمنٹ",
  "Notes": "نوٹس",
  "optional": "اختیاری",
  "Update transaction": "لین دین اپ ڈیٹ کریں",
  "Updating…": "اپ ڈیٹ ہو رہا ہے…",
  "Save transaction": "لین دین محفوظ کریں",
  "Saving…": "محفوظ ہو رہا ہے…",
  "Description": "تفصیل",
  "Private notes": "ذاتی نوٹس",
  "Update private expense": "ذاتی خرچ اپ ڈیٹ کریں",
  "Add private expense": "ذاتی خرچ شامل کریں",
  "Virtual envelopes": "مجازی بچت خانے",
  "Savings that have a purpose": "مقصد کے ساتھ بچت",
  "Record external savings deposits, protect them with goals, and keep your calculated bank balance accurate.":
    "باہر سے آنے والی بچت جمع کریں، اہداف کے ذریعے محفوظ رکھیں اور حساب شدہ بینک بیلنس درست رکھیں۔",
  "Every rupee stays in your bank account while goals make sure it is not accidentally spent.":
    "ہر روپیہ بینک میں رہتا ہے جبکہ اہداف اسے غیر ارادی خرچ ہونے سے محفوظ رکھتے ہیں۔",
  "Move savings": "بچت منتقل کریں",
  "Contributions and withdrawals change what is reserved, not the bank ledger.":
    "جمع اور نکلوائی محفوظ رقم بدلتی ہے، بینک لیجر نہیں۔",
  "Contributions increase the calculated bank, withdrawals decrease it, and transfers stay bank-neutral.":
    "بچت کی جمع حساب شدہ بینک بیلنس بڑھاتی ہے، نکلوائی کم کرتی ہے اور اہداف کے درمیان منتقلی بیلنس نہیں بدلتی۔",
  "Create a savings goal": "بچت کا ہدف بنائیں",
  "Total reserved": "کل محفوظ رقم",
  "Active": "فعال",
  "Open-ended savings · no target required": "غیر محدود بچت · ہدف ضروری نہیں",
  "Savings ledger": "بچت کا لیجر",
  "Credits and debits": "جمع اور نکلوائی",
  "Filter by goal": "ہدف کے مطابق فلٹر کریں",
  "All savings goals": "تمام بچت کے اہداف",
  "Total credited": "کل جمع شدہ",
  "Total debited": "کل نکلوائی",
  "Movement": "منتقلی",
  "Credit": "جمع",
  "Debit": "نکلوائی",
  "Internal allocation": "اندرونی تقسیم",
  "No notes": "کوئی نوٹس نہیں",
  "Internal movement · bank-neutral": "اندرونی منتقلی · بینک بیلنس پر اثر نہیں",
  "Calculated bank increases": "حساب شدہ بینک بیلنس بڑھتا ہے",
  "Calculated bank decreases": "حساب شدہ بینک بیلنس کم ہوتا ہے",
  "Opening balances are included in each goal balance but are not recorded as movements.":
    "ابتدائی بیلنس ہر ہدف کے بیلنس میں شامل ہے مگر منتقلی کے طور پر ریکارڈ نہیں ہوتا۔",
  "No savings movements yet": "ابھی بچت کی کوئی منتقلی نہیں",
  "No movements for this goal": "اس ہدف کے لیے کوئی منتقلی نہیں",
  "Contributions, withdrawals, transfers, and monthly allocations will appear here.":
    "جمع، نکلوائی، اہداف کے درمیان منتقلی اور ماہانہ تقسیم یہاں نظر آئیں گی۔",
  "Create your first savings envelope": "اپنا پہلا بچت خانہ بنائیں",
  "Goals can represent emergency savings, gifts, a baby fund, travel, or anything important.":
    "اہداف ہنگامی بچت، تحائف، بچوں کے فنڈ، سفر یا کسی بھی اہم مقصد کے لیے ہو سکتے ہیں۔",
  "Goal name": "ہدف کا نام",
  "Opening amount": "ابتدائی رقم",
  "Target": "ہدف",
  "No fixed target": "کوئی مقررہ ہدف نہیں",
  "Reports": "رپورٹس",
  "Turn monthly habits into a clear story": "ماہانہ عادات کو واضح مالی تصویر بنائیں",
  "Compare what came in, where it went, and how much stayed protected.":
    "دیکھیں کتنی رقم آئی، کہاں خرچ ہوئی اور کتنی محفوظ رہی۔",
  "Download CSV": "CSV ڈاؤن لوڈ کریں",
  "Full backup": "مکمل بیک اپ",
  "Latest income": "تازہ ترین آمدنی",
  "Latest spending": "تازہ ترین اخراجات",
  "Net cash flow": "خالص کیش فلو",
  "Spending mix": "اخراجات کی تقسیم",
  "Income and expenses by month": "ماہانہ آمدنی اور اخراجات",
  "Household": "گھرانہ",
  "Personal": "ذاتی",
  "Protected money": "محفوظ رقم",
  "Savings growth": "بچت میں اضافہ",
  "Reports begin after your first transaction": "رپورٹس پہلے لین دین کے بعد شروع ہوں گی",
  "Your income, expenses, cash flow, and savings trends will appear here automatically.":
    "آپ کی آمدنی، اخراجات، کیش فلو اور بچت کے رجحانات یہاں خودکار طور پر نظر آئیں گے۔",
  "Nothing important should slip": "کوئی اہم بات رہ نہ جائے",
  "Bill due dates and savings target reminders appear here before they become surprises.":
    "بلوں کی آخری تاریخ اور بچت کے ہدف کی یاد دہانیاں بروقت یہاں نظر آئیں گی۔",
  "Mark all read": "سب کو پڑھا ہوا نشان لگائیں",
  "You are all caught up": "تمام اطلاعات دیکھ لی گئیں",
  "Upcoming bills and savings reminders will appear here.":
    "آنے والے بل اور بچت کی یاد دہانیاں یہاں نظر آئیں گی۔",
  "Household settings": "گھرانے کی ترتیبات",
  "The rules behind your monthly plan": "آپ کے ماہانہ منصوبے کے اصول",
  "Opening balances, recurring items, invitations, and reconciliation live here.":
    "ابتدائی بیلنس، مستقل آئٹمز، دعوت نامے اور بینک تصدیق یہاں موجود ہیں۔",
  "Tracked bank account": "ریکارڈ شدہ بینک اکاؤنٹ",
  "Reconcile": "بیلنس کی تصدیق",
  "Reconcile your bank": "اپنے بینک بیلنس کی تصدیق کریں",
  "Enter the balance shown by your bank. Adjustments are never posted silently.":
    "بینک میں دکھائی جانے والی رقم درج کریں۔ ایڈجسٹمنٹ ہمیشہ واضح طور پر ریکارڈ ہوگی۔",
  "Monthly savings target · PKR · Asia/Karachi": "ماہانہ بچت کا ہدف · PKR · ایشیا/کراچی",
  "Edit monthly savings": "ماہانہ بچت میں ترمیم",
  "Edit savings": "بچت میں ترمیم",
  "This updates the recurring target and the newest active month. Earlier months stay unchanged, and savings remain an internal bank-neutral allocation.":
    "یہ مستقل ہدف اور تازہ ترین فعال مہینے کو اپ ڈیٹ کرتا ہے۔ پہلے مہینے تبدیل نہیں ہوتے اور بچت اندرونی تقسیم رہتی ہے جس سے بینک بیلنس نہیں بدلتا۔",
  "This amount is reserved internally when income is received. It does not create a second bank transaction.":
    "آمدنی وصول ہونے پر یہ رقم اندرونی طور پر محفوظ ہوتی ہے۔ اس سے دوسرا بینک لین دین نہیں بنتا۔",
  "Please enter a valid monthly savings amount.": "درست ماہانہ بچت کی رقم درج کریں۔",
  "Update monthly savings": "ماہانہ بچت اپ ڈیٹ کریں",
  "Monthly generator": "ماہانہ جنریٹر",
  "Recurring plan": "مستقل منصوبہ",
  "Income sources": "آمدنی کے ذرائع",
  "Copied into each new month": "ہر نئے مہینے میں نقل کیا جاتا ہے",
  "Household bills": "گھریلو بل",
  "Edit income source": "آمدنی کے ذریعے میں ترمیم",
  "Edit household bill": "گھریلو بل میں ترمیم",
  "Your edit updates the recurring plan and its matching item in the newest month. Earlier months stay unchanged.":
    "آپ کی ترمیم مستقل منصوبے اور تازہ ترین مہینے میں متعلقہ آئٹم کو اپ ڈیٹ کرے گی۔ پچھلے مہینے تبدیل نہیں ہوں گے۔",
  "Household access": "گھرانے تک رسائی",
  "Invitations": "دعوت نامے",
  "Invite": "دعوت دیں",
  "Invite a household member": "گھرانے کے رکن کو دعوت دیں",
  "No pending invitations. You can always copy a link if email is in test mode.":
    "کوئی زیر التوا دعوت نہیں۔ ٹیسٹ موڈ میں آپ لنک نقل کر سکتے ہیں۔",
  "Member access": "رکن کی رسائی",
  "You can view household summaries and manage your private spending. Shared plan changes remain with the owner.":
    "آپ گھرانے کا خلاصہ دیکھ اور اپنے ذاتی اخراجات سنبھال سکتے ہیں۔ مشترکہ منصوبہ صرف مالک تبدیل کر سکتا ہے۔",
  "Actual balance": "اصل بیلنس",
  "Reason or note": "وجہ یا نوٹ",
  "recommended": "تجویز کردہ",
  "Post the difference as an adjustment": "فرق کو ایڈجسٹمنٹ کے طور پر ریکارڈ کریں",
  "Leave off to keep the variance visible without changing the ledger.":
    "لیجر بدلے بغیر فرق دکھانے کے لیے اسے بند رکھیں۔",
  "Save reconciliation": "تصدیق محفوظ کریں",
  "Google account email": "گوگل اکاؤنٹ ای میل",
  "Create invitation": "دعوت نامہ بنائیں",
  "Name": "نام",
  "Account management": "اکاؤنٹ کا انتظام",
  "Your access and household role": "آپ کی رسائی اور گھرانے میں کردار",
  "Review membership, transfer ownership safely, or manage your account.":
    "رکنیت دیکھیں، ملکیت محفوظ طریقے سے منتقل کریں یا اپنا اکاؤنٹ سنبھالیں۔",
  "Signed in with Google": "گوگل کے ذریعے سائن اِن",
  "Privacy policy": "رازداری کی پالیسی",
  "Private by default": "بنیادی طور پر نجی",
  "People": "افراد",
  "Household members": "گھرانے کے افراد",
  "Make owner": "مالک بنائیں",
  "Danger zone": "خطرناک اقدامات",
  "Delete household and account": "گھرانہ اور اکاؤنٹ حذف کریں",
  "Leave or delete account": "اکاؤنٹ چھوڑیں یا حذف کریں",
  "Leave household": "گھرانہ چھوڑیں",
  "Delete account": "اکاؤنٹ حذف کریں",
  "Welcome": "خوش آمدید",
  "Let’s build your first calm month.": "آئیے آپ کا پہلا پُرسکون مہینہ بنائیں۔",
  "This takes about three minutes. You can change every value later.":
    "اس میں تقریباً تین منٹ لگیں گے۔ آپ ہر قدر بعد میں تبدیل کر سکتے ہیں۔",
  "Your foundation": "آپ کی بنیاد",
  "Household and bank": "گھرانہ اور بینک",
  "Monthly plan": "ماہانہ منصوبہ",
  "Income and bills": "آمدنی اور بل",
  "Protect savings": "بچت محفوظ کریں",
  "Goals and review": "اہداف اور جائزہ",
  "Start with the real balance": "اصل بیلنس سے شروع کریں",
  "This becomes the opening point for your calculated bank ledger.":
    "یہ آپ کے حساب شدہ بینک لیجر کا ابتدائی نقطہ ہوگا۔",
  "Household name": "گھرانے کا نام",
  "Bank label": "بینک کا نام",
  "Current bank balance": "موجودہ بینک بیلنس",
  "Balance date": "بیلنس کی تاریخ",
  "Fixed monthly savings target": "مقررہ ماہانہ بچت کا ہدف",
  "This is reserved before calculating safe-to-spend money.":
    "خرچ کے لیے محفوظ رقم نکالنے سے پہلے یہ رقم محفوظ کی جاتی ہے۔",
  "Shape a normal month": "ایک معمول کا مہینہ بنائیں",
  "These templates create the plan. Actual payments always start at zero.":
    "یہ ٹیمپلیٹس منصوبہ بناتے ہیں۔ اصل ادائیگیاں ہمیشہ صفر سے شروع ہوتی ہیں۔",
  "At least one is required": "کم از کم ایک ضروری ہے",
  "Add": "شامل کریں",
  "Add only recurring planned costs": "صرف مستقل منصوبہ شدہ اخراجات شامل کریں",
  "Income source name": "آمدنی کے ذریعے کا نام",
  "What should we call this income?": "اس آمدنی کو کیا نام دیا جائے؟",
  "Expected monthly income": "متوقع ماہانہ آمدنی",
  "Enter the amount you normally receive.": "وہ رقم درج کریں جو آپ عموماً وصول کرتے ہیں۔",
  "Remove income source": "آمدنی کا ذریعہ ہٹائیں",
  "Household bill name": "گھریلو بل کا نام",
  "What recurring bill is this?": "یہ کون سا مستقل بل ہے؟",
  "Expected monthly bill amount": "متوقع ماہانہ بل کی رقم",
  "How much do you normally expect to pay?": "آپ عموماً کتنی رقم ادا کرنے کی توقع رکھتے ہیں؟",
  "Due day of month": "مہینے میں ادائیگی کا دن",
  "Calendar day 1–31. Short months use their final day.":
    "کیلنڈر کا دن 1 تا 31۔ چھوٹے مہینوں میں آخری دن استعمال ہوگا۔",
  "Remove household bill": "گھریلو بل ہٹائیں",
  "Give savings a purpose": "بچت کو مقصد دیں",
  "These are virtual envelopes inside the same bank account.":
    "یہ اسی بینک اکاؤنٹ کے اندر مجازی بچت خانے ہیں۔",
  "Opening amounts set your savings baseline; future contributions record new money entering the bank.":
    "ابتدائی رقوم آپ کی بچت کی بنیاد طے کرتی ہیں؛ آئندہ جمع ہونے والی بچت بینک میں آنے والی نئی رقم ریکارڈ کرے گی۔",
  "Savings goals": "بچت کے اہداف",
  "Targets are optional": "اہداف اختیاری ہیں",
  "Savings goal name": "بچت کے ہدف کا نام",
  "What are you saving this money for?": "آپ یہ رقم کس مقصد کے لیے بچا رہے ہیں؟",
  "Amount already saved": "پہلے سے محفوظ رقم",
  "Only money already included in your bank balance.":
    "صرف وہ رقم جو پہلے ہی آپ کے بینک بیلنس میں شامل ہے۔",
  "Optional total amount you want to reach.": "اختیاری کل رقم جس تک آپ پہنچنا چاہتے ہیں۔",
  "Remove savings goal": "بچت کا ہدف ہٹائیں",
  "Already saved": "پہلے سے محفوظ",
  "Goal target": "ہدف کی رقم",
  "Optional": "اختیاری",
  "Recurring bills": "مستقل بل",
  "Back": "واپس",
  "Continue": "جاری رکھیں",
  "Creating your household…": "آپ کا گھرانہ بنایا جا رہا ہے…",
  "Open my dashboard": "میرا ڈیش بورڈ کھولیں",
  "Something went wrong.": "کچھ غلط ہو گیا۔",
  "We couldn’t load this section.": "یہ حصہ لوڈ نہیں ہو سکا۔",
  "Please refresh or try again shortly.": "صفحہ ریفریش کریں یا کچھ دیر بعد دوبارہ کوشش کریں۔",
  "Close": "بند کریں",
  "Contribution": "جمع",
  "Withdrawal": "نکلوائی",
  "Transfer": "منتقلی",
  "From": "کہاں سے",
  "To": "کہاں",
  "Choose a goal": "ہدف منتخب کریں",
  "Save movement": "منتقلی محفوظ کریں",
  "Edit savings goal": "بچت کے ہدف میں ترمیم",
  "Update the goal name, target, or active status. Use a movement to change its balance.":
    "ہدف کا نام، مطلوبہ رقم یا فعال حالت اپ ڈیٹ کریں۔ بیلنس بدلنے کے لیے منتقلی ریکارڈ کریں۔",
  "Starting reserved balance": "ابتدائی محفوظ بیلنس",
  "Use only for savings already included in your opening bank balance. Record new money with Add movement.":
    "صرف اس بچت کے لیے استعمال کریں جو ابتدائی بینک بیلنس میں پہلے سے شامل ہے۔ نئی رقم ’منتقلی شامل کریں‘ سے ریکارڈ کریں۔",
  "Inactive": "غیر فعال",
  "Active goal": "فعال ہدف",
  "Inactive goals remain in your history but can no longer receive new savings.":
    "غیر فعال اہداف آپ کی تاریخ میں رہیں گے مگر نئی بچت وصول نہیں کر سکیں گے۔",
  "Update goal": "ہدف اپ ڈیٹ کریں",
  "Start guided tour": "رہنمائی کا دورہ شروع کریں",
  "Skip guided tour": "رہنمائی کا دورہ چھوڑیں",
  "Welcome to Ravani": "روانی میں خوش آمدید",
  "Your monthly money has a clear flow now": "اب آپ کے ماہانہ پیسے کی روانی واضح ہے",
  "Ravani turns your salary, household commitments, personal spending, savings, and real bank balance into one connected monthly plan.":
    "روانی آپ کی تنخواہ، گھریلو ذمہ داریوں، ذاتی اخراجات، بچت اور حقیقی بینک بیلنس کو ایک مربوط ماہانہ منصوبے میں بدلتی ہے۔",
  "Record what actually happened instead of replacing your original plan.":
    "اصل منصوبہ بدلنے کے بجائے وہی ریکارڈ کریں جو حقیقت میں ہوا۔",
  "This walkthrough will open each important area and show you what to do there.":
    "یہ رہنمائی ہر اہم حصے کو کھول کر دکھائے گی کہ وہاں کیا کرنا ہے۔",
  "Begin each visit with the big picture": "ہر بار آغاز مکمل مالی تصویر سے کریں",
  "Overview is your financial home screen. It answers what is available, reserved, unpaid, and reflected in the bank.":
    "جائزہ آپ کی مالی ہوم اسکرین ہے۔ یہاں دستیاب، محفوظ، بقایا اور بینک میں ظاہر ہونے والی رقم واضح ہوتی ہے۔",
  "Use Open month when you need to record new activity.":
    "نئی سرگرمی ریکارڈ کرنے کے لیے ’مہینہ کھولیں‘ استعمال کریں۔",
  "The left navigation takes you to every workspace; on mobile, open it with the menu button.":
    "بائیں جانب نیویگیشن سے ہر ورک اسپیس کھلتی ہے؛ موبائل پر اسے مینو بٹن سے کھولیں۔",
  "Dashboard summary": "ڈیش بورڈ خلاصہ",
  "Read these four numbers together": "ان چار اعداد کو ایک ساتھ سمجھیں",
  "Safe to spend is what remains after planned bills, savings, and personal spending. Calculated bank is built from recorded cash flow.":
    "خرچ کے لیے محفوظ رقم منصوبہ شدہ بلوں، بچت اور ذاتی اخراجات کے بعد باقی رقم ہے۔ حساب شدہ بینک ریکارڈ شدہ کیش فلو سے بنتا ہے۔",
  "House balance shows household obligations still unpaid.":
    "گھریلو بقایا وہ ذمہ داریاں دکھاتا ہے جو ابھی ادا نہیں ہوئیں۔",
  "Savings reserved is money still in your bank but protected inside savings goals.":
    "محفوظ بچت وہ رقم ہے جو بینک میں موجود ہے مگر بچت کے اہداف میں مختص ہے۔",
  "Monthly health": "ماہانہ مالی صحت",
  "Spot trends and unfinished work": "رجحانات اور باقی کام فوراً پہچانیں",
  "The dashboard compares income with spending, tracks progress toward this month’s savings target, and lists bills still waiting.":
    "ڈیش بورڈ آمدنی اور اخراجات کا موازنہ، ماہانہ بچت کی پیش رفت اور باقی بلوں کی فہرست دکھاتا ہے۔",
  "A reconciliation warning means Ravani’s calculated balance differs from the balance you entered from your bank.":
    "بینک تصدیق کی تنبیہ کا مطلب ہے کہ روانی کا حساب شدہ بیلنس آپ کے درج کردہ اصل بینک بیلنس سے مختلف ہے۔",
  "These cards update automatically whenever you record or edit a transaction.":
    "لین دین ریکارڈ یا تبدیل کرتے ہی یہ کارڈ خودکار طور پر اپ ڈیٹ ہوتے ہیں۔",
  "This is where the month is recorded": "مہینے کا مکمل حساب یہاں ریکارڈ ہوتا ہے",
  "Choose any existing month, add a current or previous month, and record income, bills, savings allocations, and private expenses.":
    "کوئی موجودہ مہینہ منتخب کریں، حالیہ یا پچھلا مہینہ شامل کریں اور آمدنی، بل، بچت کی تقسیم اور ذاتی اخراجات ریکارڈ کریں۔",
  "Recurring income and bills are copied into a month as a plan; only recorded payments affect cash flow.":
    "مستقل آمدنی اور بل منصوبے کے طور پر مہینے میں نقل ہوتے ہیں؛ صرف ریکارڈ شدہ ادائیگیاں کیش فلو بدلتی ہیں۔",
  "When creating the next month, Ravani helps distribute eligible leftovers and unpaid amounts.":
    "اگلا مہینہ بناتے وقت روانی متعلقہ بچی ہوئی اور غیر ادا شدہ رقم تقسیم کرنے میں مدد کرتی ہے۔",
  "Plan and progress": "منصوبہ اور پیش رفت",
  "Compare the plan with what was paid": "منصوبے کا اصل ادائیگی سے موازنہ کریں",
  "The monthly summary shows the household plan, total paid, completion progress, and fixed savings target for the selected month.":
    "ماہانہ خلاصہ منتخب مہینے کا گھریلو منصوبہ، کل ادائیگی، تکمیل کی پیش رفت اور مقررہ بچت کا ہدف دکھاتا ہے۔",
  "Use Receive beside an income source only when money reaches your bank.":
    "آمدنی کے ذریعے کے ساتھ ’وصول کریں‘ صرف تب استعمال کریں جب رقم بینک میں پہنچ جائے۔",
  "Use Add payment beside a bill; partial and overpayments are supported and unpaid amounts remain visible.":
    "بل کے ساتھ ’ادائیگی شامل کریں‘ استعمال کریں؛ جزوی اور زائد ادائیگی ممکن ہے اور بقایا رقم نظر آتی رہے گی۔",
  "Track every household expense against its plan":
    "ہر گھریلو خرچ کو اس کے منصوبے کے مقابل ریکارڈ کریں",
  "The Household expenses table keeps the expected amount, due date, paid amount, unpaid balance, and current payment status together.":
    "گھریلو اخراجات کی جدول متوقع رقم، آخری تاریخ، ادا شدہ رقم، بقایا اور موجودہ ادائیگی کی حالت ایک جگہ دکھاتی ہے۔",
  "Use Add payment to record a full, partial, or overpayment without changing the original expectation.":
    "اصل متوقع رقم بدلے بغیر مکمل، جزوی یا زائد ادائیگی ریکارڈ کرنے کے لیے ’ادائیگی شامل کریں‘ استعمال کریں۔",
  "Unpaid amounts stay visible, while eligible overpayments can be carried into the following month.":
    "غیر ادا شدہ رقم نظر آتی رہتی ہے جبکہ متعلقہ زائد ادائیگی اگلے مہینے میں منتقل کی جا سکتی ہے۔",
  "Your actual household cash movements live here": "گھرانے کے حقیقی مالی لین دین یہاں محفوظ ہیں",
  "Received income, household payments, and reconciliation adjustments appear in the shared transaction history.":
    "وصول شدہ آمدنی، گھریلو ادائیگیاں اور بینک تصدیقی ایڈجسٹمنٹ مشترکہ لین دین کی تاریخ میں نظر آتی ہیں۔",
  "Edit an entry to correct its date, amount, or notes; delete it if it should not exist.":
    "تاریخ، رقم یا نوٹس درست کرنے کے لیے اندراج میں ترمیم کریں؛ غیر ضروری ہو تو حذف کریں۔",
  "Every correction immediately recalculates the dashboard, bank balance, and reports.":
    "ہر درستگی ڈیش بورڈ، بینک بیلنس اور رپورٹس کا حساب فوراً دوبارہ کرتی ہے۔",
  "Private spending": "ذاتی اخراجات",
  "Personal expense details stay private": "ذاتی اخراجات کی تفصیل نجی رہتی ہے",
  "Add your own day-to-day spending from the monthly workspace, then edit or delete it from Your personal expenses.":
    "ماہانہ ورک اسپیس سے روزمرہ ذاتی خرچ شامل کریں، پھر ’آپ کے ذاتی اخراجات‘ میں اسے تبدیل یا حذف کریں۔",
  "Other members cannot see your descriptions, notes, or individual entries.":
    "دوسرے ارکان آپ کی تفصیل، نوٹس یا انفرادی اندراجات نہیں دیکھ سکتے۔",
  "The household dashboard uses only an anonymous combined personal-spending total.":
    "گھرانے کا ڈیش بورڈ صرف بغیر نام کے مشترکہ ذاتی اخراجات کا مجموعہ استعمال کرتا ہے۔",
  "Give protected money a purpose": "محفوظ رقم کو ایک مقصد دیں",
  "Household owners create goals such as Emergency Fund or Travel, set optional targets, and edit a goal without rewriting its history.":
    "گھرانے کے مالک ہنگامی فنڈ یا سفر جیسے اہداف بناتے، اختیاری ہدف مقرر کرتے اور تاریخ بدلے بغیر ہدف میں ترمیم کرتے ہیں۔",
  "Owners use Add movement to record a contribution, withdrawal, allocation, or transfer.":
    "مالک ’منتقلی شامل کریں‘ سے جمع، نکلوائی، مختص رقم یا منتقلی ریکارڈ کرتے ہیں۔",
  "Transfers and monthly allocations move money internally; external contributions and withdrawals also affect calculated bank.":
    "اہداف کے درمیان منتقلی اور ماہانہ تقسیم اندرونی حرکت ہے؛ بیرونی جمع اور نکلوائی حساب شدہ بینک کو بھی بدلتی ہے۔",
  "Savings buckets": "بچت کے خانے",
  "See how your reserved money is distributed": "دیکھیں آپ کی محفوظ رقم کیسے تقسیم ہوئی ہے",
  "Each savings bucket shows its current reserved balance, optional target, progress, and how much remains to reach that target.":
    "ہر بچت خانہ موجودہ محفوظ بیلنس، اختیاری ہدف، پیش رفت اور ہدف تک باقی رقم دکھاتا ہے۔",
  "Use separate buckets for purposes such as emergencies, travel, education, gifts, or family goals.":
    "ہنگامی ضرورت، سفر، تعلیم، تحائف یا خاندانی اہداف کے لیے الگ بچت خانے استعمال کریں۔",
  "Editing a bucket changes its name, target, or active status; use a savings movement when the balance itself changes.":
    "خانے میں ترمیم سے نام، ہدف یا فعال حالت بدلتی ہے؛ بیلنس بدلنے پر بچت کی منتقلی ریکارڈ کریں۔",
  "Savings history": "بچت کی تاریخ",
  "See every savings credit and debit": "بچت کی ہر جمع اور نکلوائی دیکھیں",
  "The savings ledger explains how each goal balance changed, including the source, destination, movement type, amount, and date.":
    "بچت لیجر دکھاتا ہے کہ ہر ہدف کا بیلنس کیسے بدلا، ساتھ ہی ذریعہ، منزل، قسم، رقم اور تاریخ بھی۔",
  "Filter the ledger by one goal when you need its complete story.":
    "کسی ایک ہدف کی مکمل تاریخ کے لیے لیجر کو اس ہدف کے مطابق فلٹر کریں۔",
  "Transfers appear as both a debit from one goal and a credit to another without changing total bank cash.":
    "منتقلی ایک ہدف سے نکلوائی اور دوسرے میں جمع کے طور پر نظر آتی ہے، مگر کل بینک رقم نہیں بدلتی۔",
  "Reports and exports": "رپورٹس اور برآمدات",
  "Understand progress across months": "مہینوں کے دوران پیش رفت سمجھیں",
  "Reports compare income, household expenses, personal spending, net cash flow, and savings growth month by month.":
    "رپورٹس ماہ بہ ماہ آمدنی، گھریلو اخراجات، ذاتی خرچ، خالص کیش فلو اور بچت میں اضافے کا موازنہ کرتی ہیں۔",
  "Download CSV when you want a spreadsheet-friendly ledger.":
    "اسپریڈشیٹ میں استعمال کے قابل لیجر کے لیے CSV ڈاؤن لوڈ کریں۔",
  "Household owners can download the explicit full JSON backup for safekeeping.":
    "گھرانے کے مالک محفوظ رکھنے کے لیے واضح مکمل JSON بیک اپ ڈاؤن لوڈ کر سکتے ہیں۔",
  "Keep bills and savings from slipping": "بل اور بچت کو نظر انداز ہونے سے بچائیں",
  "Due-date, overdue-bill, and savings-target reminders are collected here and can take you directly to the relevant action.":
    "آخری تاریخ، واجب الادا بل اور بچت کے ہدف کی یاد دہانیاں یہاں جمع ہوتی ہیں اور متعلقہ کارروائی تک لے جاتی ہیں۔",
  "Owners receive reminders for shared household finances.":
    "مالک کو مشترکہ گھریلو مالی معاملات کی یاد دہانیاں ملتی ہیں۔",
  "Use Mark all read after reviewing the latest items.":
    "تازہ اطلاعات دیکھنے کے بعد ’سب کو پڑھا ہوا نشان زد کریں‘ استعمال کریں۔",
  "Bank and household settings": "بینک اور گھرانے کی ترتیبات",
  "Keep the plan aligned with real life": "منصوبے کو حقیقی صورتحال کے مطابق رکھیں",
  "Settings holds the tracked bank account, household savings target, and the tools that define future monthly plans.":
    "ترتیبات میں زیر نگرانی بینک اکاؤنٹ، گھریلو بچت کا ہدف اور آئندہ ماہانہ منصوبے بنانے والے ٹولز موجود ہیں۔",
  "Reconcile by entering the actual balance shown by your bank; Ravani will show any variance.":
    "بینک کا دکھایا ہوا حقیقی بیلنس درج کر کے تصدیق کریں؛ روانی کوئی بھی فرق دکھائے گی۔",
  "A bank adjustment is recorded only when you explicitly choose to post one.":
    "بینک ایڈجسٹمنٹ صرف تب ریکارڈ ہوتی ہے جب آپ واضح طور پر اسے شامل کرنے کا انتخاب کریں۔",
  "Recurring plan and access": "مستقل منصوبہ اور رسائی",
  "Manage what future months inherit": "آئندہ مہینوں میں آنے والا منصوبہ سنبھالیں",
  "Edit recurring income sources and household bills here. Changes update the latest month and become the defaults for future months.":
    "مستقل آمدنی کے ذرائع اور گھریلو بل یہاں تبدیل کریں۔ تبدیلیاں تازہ مہینے کو اپ ڈیٹ کر کے آئندہ مہینوں کا معیار بنتی ہیں۔",
  "Bill settings include the expected amount, due day, and reminder lead time.":
    "بل کی ترتیبات میں متوقع رقم، آخری دن اور یاد دہانی کا پیشگی وقت شامل ہے۔",
  "Household owners can also invite members using their exact verified Google email.":
    "گھرانے کے مالک ارکان کو ان کے عین تصدیق شدہ گوگل ای میل سے مدعو کر سکتے ہیں۔",
  "Your account": "آپ کا اکاؤنٹ",
  "Review membership and account controls": "رکنیت اور اکاؤنٹ کنٹرول دیکھیں",
  "Account shows your signed-in identity, household role, privacy boundaries, and account-management actions.":
    "اکاؤنٹ آپ کی سائن ان شناخت، گھریلو کردار، رازداری کی حدود اور اکاؤنٹ انتظام کی کارروائیاں دکھاتا ہے۔",
  "Members manage only their own private spending while shared finances remain owner-controlled.":
    "ارکان صرف اپنے ذاتی اخراجات سنبھالتے ہیں جبکہ مشترکہ مالیات مالک کے اختیار میں رہتی ہیں۔",
  "Permanent actions such as leaving a household or deleting an account are kept here.":
    "گھرانہ چھوڑنے یا اکاؤنٹ حذف کرنے جیسی مستقل کارروائیاں یہاں موجود ہیں۔",
  "Language, theme, and help": "زبان، تھیم اور مدد",
  "Make Ravani comfortable to use": "روانی کو اپنی سہولت کے مطابق بنائیں",
  "Use the top bar to switch between English and Urdu, change light or dark mode, or open this detailed tour again.":
    "اوپری بار سے انگریزی اور اردو بدلیں، روشن یا تاریک موڈ منتخب کریں یا یہ تفصیلی رہنمائی دوبارہ کھولیں۔",
  "Your language preference is saved to your account for future visits.":
    "آپ کی زبان کی ترجیح آئندہ استعمال کے لیے اکاؤنٹ میں محفوظ رہتی ہے۔",
  "The question-mark button restarts this walkthrough whenever you need a refresher.":
    "جب بھی دوبارہ رہنمائی چاہیے ہو سوالیہ نشان کا بٹن یہ دورہ شروع کرتا ہے۔",
  "You’re ready": "آپ تیار ہیں",
  "Follow the flow one transaction at a time": "ہر لین دین کے ساتھ مالی روانی واضح رکھیں",
  "Start in This month, record money only when it actually moves, reserve savings with a purpose, and use Overview to check the result.":
    "’یہ مہینہ‘ سے آغاز کریں، رقم صرف حقیقت میں منتقل ہونے پر ریکارڈ کریں، مقصد کے ساتھ بچت محفوظ کریں اور نتیجہ ’جائزہ‘ میں دیکھیں۔",
  "You can return to any previous month to correct its complete financial flow.":
    "آپ کسی بھی پچھلے مہینے میں واپس جا کر اس کی مکمل مالی روانی درست کر سکتے ہیں۔",
  "Replay this tour anytime from the question-mark button in the top bar.":
    "اوپری بار کے سوالیہ نشان سے یہ رہنمائی کسی بھی وقت دوبارہ چلائیں۔",
  "We’ll remember this choice every time you open Ravani. You can change it anytime from inside the app.":
    "جب بھی آپ روانی کھولیں گے ہم یہ انتخاب یاد رکھیں گے۔ آپ اسے ایپ کے اندر کسی بھی وقت تبدیل کر سکتے ہیں۔",
  "Your finances, in one calm place": "آپ کے مالی معاملات، ایک پُرسکون جگہ پر",
  "This short tour shows where to track your month, protect savings, and understand your real financial position.":
    "یہ مختصر رہنمائی آپ کو ماہانہ حساب، بچت کی حفاظت اور حقیقی مالی صورتحال سمجھنے کا طریقہ دکھاتی ہے۔",
  "See the important numbers first": "اہم اعداد پہلے دیکھیں",
  "Your dashboard brings together safe-to-spend money, calculated bank balance, unpaid bills, savings progress, and trends.":
    "ڈیش بورڈ خرچ کے لیے محفوظ رقم، حساب شدہ بینک بیلنس، بقایا بل، بچت کی پیش رفت اور رجحانات ایک جگہ دکھاتا ہے۔",
  "Record what actually happened": "جو حقیقت میں ہوا اسے ریکارڈ کریں",
  "Receive income, pay household bills in full or partially, add private expenses, and manage previous months here.":
    "یہاں آمدنی وصول کریں، گھریلو بل مکمل یا جزوی ادا کریں، ذاتی اخراجات اور پچھلے مہینے سنبھالیں۔",
  "Give every saved rupee a purpose": "ہر محفوظ روپے کو مقصد دیں",
  "Create goals, edit their targets, and move reserved money between your virtual savings envelopes.":
    "اہداف بنائیں، مطلوبہ رقم میں ترمیم کریں اور محفوظ رقم کو مجازی بچت خانوں کے درمیان منتقل کریں۔",
  "Turn activity into a clear story": "سرگرمی کو واضح مالی تصویر بنائیں",
  "Follow income, spending, cash flow, and savings over time, then export reports or a complete backup.":
    "وقت کے ساتھ آمدنی، اخراجات، کیش فلو اور بچت دیکھیں، پھر رپورٹس یا مکمل بیک اپ برآمد کریں۔",
  "Your preferences": "آپ کی ترجیحات",
  "Make the app feel like yours": "ایپ کو اپنی پسند کے مطابق بنائیں",
  "Switch between English and Urdu anytime. You can replay this tour later from the question-mark button.":
    "کسی بھی وقت انگریزی اور اردو تبدیل کریں۔ سوالیہ نشان کے بٹن سے یہ رہنمائی دوبارہ دیکھی جا سکتی ہے۔",
  "Next": "اگلا",
  "Finish tour": "رہنمائی مکمل کریں",
  "We couldn’t save your tour progress. Please try again.":
    "رہنمائی کی پیش رفت محفوظ نہیں ہو سکی۔ دوبارہ کوشش کریں۔",
  "Add month": "مہینہ شامل کریں",
  "Open month": "مہینہ کھولیں",
  "Open monthly workspace": "ماہانہ ورک اسپیس کھولیں",
  "Open dashboard": "ڈیش بورڈ کھولیں",
  "Manage savings": "بچت کا انتظام",
  "Add movement": "منتقلی شامل کریں",
  "Allocate for this month": "اس مہینے کے لیے مختص کریں",
  "Already reserved": "پہلے سے محفوظ",
  "Add to future months": "آئندہ مہینوں میں شامل کریں",
  "Update recurring plan": "مستقل منصوبہ اپ ڈیٹ کریں",
  "Create goal": "ہدف بنائیں",
  "New goal": "نیا ہدف",
  "Personal expense": "ذاتی خرچ",
  "Only visible to you": "صرف آپ کو نظر آئے گا",
  "Expense amount": "خرچ کی رقم",
  "What was it?": "یہ کس چیز کا خرچ تھا؟",
  "Delete": "حذف کریں",
  "Edit": "ترمیم",
  "Keep month": "مہینہ برقرار رکھیں",
  "Keep transaction": "لین دین برقرار رکھیں",
  "No transactions yet": "ابھی کوئی لین دین نہیں",
  "Your activity will appear here.": "آپ کی سرگرمی یہاں نظر آئے گی۔",
  "Receive": "وصول کریں",
  "Add payment": "ادائیگی شامل کریں",
  "Due day": "آخری تاریخ کا دن",
  "Remind before": "پہلے یاد دہانی",
  "For example: Salary, freelance, or pension.": "مثلاً تنخواہ، فری لانس یا پنشن۔",
  "For example: Rent, electricity, or internet.": "مثلاً کرایہ، بجلی یا انٹرنیٹ۔",
  "The calendar day this bill is normally due.": "کیلنڈر کا وہ دن جب یہ بل عموماً واجب الادا ہوتا ہے۔",
  "Reminder lead time (days)": "یاد دہانی کا پیشگی وقت (دن)",
  "How many days before the due date to remind you.":
    "آخری تاریخ سے کتنے دن پہلے یاد دہانی چاہیے۔",
  "Owner managed": "مالک کے زیر انتظام",
  "Copy invitation link": "دعوت کا لنک نقل کریں",
  "Monthly salary": "ماہانہ تنخواہ",
  "Income name": "آمدنی کا نام",
  "Income amount": "آمدنی کی رقم",
  "Expense name": "خرچ کا نام",
  "Month": "مہینہ",
  "Could not create this month.": "یہ مہینہ نہیں بنایا جا سکا۔",
  "Could not delete this month. Please try again.":
    "یہ مہینہ حذف نہیں ہو سکا۔ دوبارہ کوشش کریں۔",
  "Could not delete this transaction. Please try again.":
    "یہ لین دین حذف نہیں ہو سکا۔ دوبارہ کوشش کریں۔",
  "Could not record this reconciliation.": "بینک بیلنس کی تصدیق ریکارڈ نہیں ہو سکی۔",
  "Could not save this expense.": "یہ خرچ محفوظ نہیں ہو سکا۔",
  "Could not update this transaction. Check the date and amount.":
    "لین دین اپ ڈیٹ نہیں ہو سکا۔ تاریخ اور رقم چیک کریں۔",
  "Please check the amount and try again.": "رقم چیک کر کے دوبارہ کوشش کریں۔",
  "Please check the values.": "درج کردہ معلومات چیک کریں۔",
  "Please review required fields and unique goal names.":
    "ضروری خانے اور منفرد ہدف نام چیک کریں۔",
  "Check the selected goals, date, and available amount.":
    "منتخب اہداف، تاریخ اور دستیاب رقم چیک کریں۔",
  "Create a savings goal before allocating savings.":
    "بچت مختص کرنے سے پہلے ایک ہدف بنائیں۔",
  "Goal names must be unique.": "ہر ہدف کا نام منفرد ہونا چاہیے۔",
  "A pending invitation may already exist.": "ممکن ہے دعوت نامہ پہلے ہی زیر التوا ہو۔",
  "They must sign in with this exact Google email and cannot already belong to another household.":
    "انہیں اسی گوگل ای میل سے سائن اِن کرنا ہوگا اور وہ پہلے سے کسی دوسرے گھرانے کا حصہ نہیں ہو سکتے۔",
  "This invitation is invalid, expired, or belongs to another Google email.":
    "یہ دعوت نامہ غلط، میعاد ختم شدہ یا کسی دوسری گوگل ای میل کے لیے ہے۔",
  "This records a virtual allocation for the selected month without creating another bank transaction.":
    "یہ نیا بینک لین دین بنائے بغیر منتخب مہینے کے لیے مجازی بچت مختص کرتا ہے۔",
  "Income, bills, due dates, and the savings target are copied from your recurring plan.":
    "آمدنی، بل، آخری تاریخیں اور بچت کا ہدف آپ کے مستقل منصوبے سے نقل ہوتے ہیں۔",
  "We’ll check the previous month for money that still needs a destination.":
    "ہم پچھلے مہینے کی اس رقم کو دیکھیں گے جس کے لیے ابھی منزل منتخب کرنا باقی ہے۔",
  "Previous month closeout": "پچھلے مہینے کا اختتام",
  "New month allocations": "نئے مہینے کی تقسیم",
  "Give every reserved amount a destination": "ہر محفوظ رقم کے لیے منزل منتخب کریں",
  "These are internal allocations. Your calculated bank balance will not change.":
    "یہ اندرونی تقسیم ہے۔ آپ کا حساب شدہ بینک بیلنس تبدیل نہیں ہوگا۔",
  "Unpaid household amounts": "غیر ادا شدہ گھریلو رقوم",
  "Fixed monthly savings": "مقررہ ماہانہ بچت",
  "Savings goal for fixed savings": "مقررہ بچت کا ہدف",
  "Choose a savings goal for each amount that was planned but not paid.":
    "ہر منصوبہ شدہ مگر غیر ادا شدہ رقم کے لیے بچت کا ہدف منتخب کریں۔",
  "Choose savings goal": "بچت کا ہدف منتخب کریں",
  "Safe-to-spend leftover": "خرچ کے لیے محفوظ بچی ہوئی رقم",
  "What should happen to this amount?": "اس رقم کے ساتھ کیا کیا جائے؟",
  "Choose an action": "اقدام منتخب کریں",
  "Add to the new month’s safe to spend": "نئے مہینے کی خرچ کے لیے محفوظ رقم میں شامل کریں",
  "Move to a savings goal": "بچت کے ہدف میں منتقل کریں",
  "Savings goal": "بچت کا ہدف",
  "Create or reactivate a savings goal before allocating fixed savings or unpaid household amounts.":
    "مقررہ بچت یا غیر ادا شدہ گھریلو رقوم تقسیم کرنے سے پہلے بچت کا ہدف بنائیں یا دوبارہ فعال کریں۔",
  "Change month": "مہینہ تبدیل کریں",
  "Could not create this month. Please review the rollover choices.":
    "یہ مہینہ نہیں بنایا جا سکا۔ منتقلی کے انتخاب دوبارہ دیکھیں۔",
  "Checking previous month…": "پچھلا مہینہ دیکھا جا رہا ہے…",
  "Create month and apply choices": "مہینہ بنائیں اور انتخاب لاگو کریں",
  "This amount from the previous month is included in this month’s safe to spend.":
    "پچھلے مہینے کی یہ رقم اس مہینے کی خرچ کے لیے محفوظ رقم میں شامل ہے۔",
  "Members see only their own personal expense details. The owner can include all private entries only in an explicit full backup.":
    "ارکان صرف اپنے ذاتی اخراجات کی تفصیل دیکھتے ہیں۔ مالک تمام نجی اندراجات صرف واضح مکمل بیک اپ میں شامل کر سکتا ہے۔",
  "Owners must transfer ownership while another active member remains. Account deletion is permanent.":
    "کسی فعال رکن کی موجودگی میں مالک کو پہلے ملکیت منتقل کرنا ہوگی۔ اکاؤنٹ کا حذف ہونا مستقل ہے۔",
  "Ownership could not be transferred. Please try again.":
    "ملکیت منتقل نہیں ہو سکی۔ دوبارہ کوشش کریں۔",
  "This action is not available yet. An owner may need to transfer ownership first.":
    "یہ عمل ابھی دستیاب نہیں۔ مالک کو پہلے ملکیت منتقل کرنا پڑ سکتی ہے۔",
};

function translate(message: string): string {
  const exact = urduMessages[message];
  if (exact) return exact;

  const step = message.match(/^Step (\d+) of (\d+)$/);
  if (step) return `مرحلہ ${step[1]} از ${step[2]}`;

  const welcome = message.match(/^Welcome,\s*(.+)$/);
  if (welcome) return `خوش آمدید، ${welcome[1]}`;

  const dueDay = message.match(/^Due day (\d+) · (\d+) days notice$/);
  if (dueDay) return `آخری تاریخ ${dueDay[1]} · ${dueDay[2]} دن پہلے اطلاع`;

  const rolloverHeading = message.match(/^Decide where (.+) leftovers should go$/);
  if (rolloverHeading) return `طے کریں کہ ${rolloverHeading[1]} کی بچی ہوئی رقم کہاں جائے`;

  const unpaidLeft = message.match(/^(.+) left unpaid$/);
  if (unpaidLeft) return `${unpaidLeft[1]} غیر ادا شدہ`;

  const safeLeft = message.match(/^(.+) remained after planned bills, savings, and personal spending\.$/);
  if (safeLeft) {
    return `منصوبہ شدہ بلوں، بچت اور ذاتی اخراجات کے بعد ${safeLeft[1]} باقی رہے۔`;
  }

  const carriedForward = message.match(/^(.+) carried forward$/);
  if (carriedForward) return `${carriedForward[1]} اگلے مہینے منتقل`;

  const fixedSavings = message.match(
    /^(.+) will be reserved for the new month\. Choose the savings goal that should receive it\.$/,
  );
  if (fixedSavings) {
    return `${fixedSavings[1]} نئے مہینے کے لیے محفوظ ہوں گے۔ وصول کرنے والا بچت ہدف منتخب کریں۔`;
  }

  const receivedIncome = message.match(/^(.+) will be recorded in your bank balance$/);
  if (receivedIncome) return `${receivedIncome[1]} آپ کے بینک بیلنس میں ریکارڈ ہوں گے`;

  const internalSavings = message.match(
    /^(.+) will move into this savings bucket internally\. It will not change your bank balance again\.$/,
  );
  if (internalSavings) {
    return `${internalSavings[1]} اندرونی طور پر اس بچت ہدف میں منتقل ہوں گے۔ اس سے آپ کا بینک بیلنس دوبارہ تبدیل نہیں ہوگا۔`;
  }

  const receiveAmount = message.match(/^Receive (.+)$/);
  if (receiveAmount) return `${receiveAmount[1]} وصول کریں`;

  return message;
}

function translateNode(node: Node) {
  if (node.nodeType === Node.TEXT_NODE) {
    const value = node.textContent ?? "";
    const trimmed = value.trim();
    if (!trimmed) return;
    const translated = translate(trimmed);
    if (translated !== trimmed) {
      node.textContent = value.replace(trimmed, translated);
    }
    return;
  }

  if (!(node instanceof HTMLElement)) return;
  for (const attribute of ["placeholder", "aria-label", "title"] as const) {
    const value = node.getAttribute(attribute);
    if (!value) continue;
    const translated = translate(value);
    if (translated !== value) node.setAttribute(attribute, translated);
  }
  node.childNodes.forEach(translateNode);
}

interface I18nValue {
  language: AppLanguage;
  direction: "ltr" | "rtl";
  t: (message: string) => string;
}

const I18nContext = createContext<I18nValue>({
  language: "en",
  direction: "ltr",
  t: (message) => message,
});

export function I18nProvider({
  language,
  children,
}: {
  language: AppLanguage;
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const value = useMemo<I18nValue>(
    () => ({
      language,
      direction: language === "ur" ? "rtl" : "ltr",
      t: language === "ur" ? translate : (message) => message,
    }),
    [language],
  );

  document.documentElement.lang = language;
  document.documentElement.dir = value.direction;

  useLayoutEffect(() => {
    if (language !== "ur") return;
    const root = rootRef.current;
    if (!root) return;
    translateNode(root);
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        record.addedNodes.forEach(translateNode);
        if (record.type === "characterData") translateNode(record.target);
      }
    });
    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    return () => observer.disconnect();
  }, [language]);

  return (
    <I18nContext.Provider value={value}>
      <div className="i18n-root" ref={rootRef}>
        {children}
      </div>
    </I18nContext.Provider>
  );
}

// This hook intentionally shares the component module so the DOM translation
// observer and its context remain one implementation detail.
// eslint-disable-next-line react-refresh/only-export-components
export function useI18n() {
  return useContext(I18nContext);
}
