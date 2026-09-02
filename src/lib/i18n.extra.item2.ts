/**
 * Second dictionary module for the item workspace page: sticky bar, timeline,
 * relations, placements, estimates, AI summary, scheduling and link previews.
 */
export const itemExtraMessages = {
  en: {
    "item.bar.running": "Running",
    "item.bar.idle": "Not running",

    "item.tab.timeline": "Timeline",
    "item.timeline.empty": "Nothing recorded yet.",
    "item.timeline.session": "Work session · {duration}",
    "item.timeline.attachment": "File added: {name}",
    "item.timeline.subtaskAdded": "Subtask added: {title}",
    "item.timeline.note": "Note: {title}",
    "item.timeline.link": "Link added: {url}",
    "item.timeline.created": "Item created",

    "item.autoProgress": "Auto progress from subtasks",
    "item.autoProgressHint": "Progress follows the share of completed subtasks.",

    "item.relations.title": "Task relations",
    "item.relations.blockedBy": "Blocked by",
    "item.relations.blocks": "Blocks",
    "item.relations.related": "Related to",
    "item.relations.add": "Link a task…",
    "item.relations.remove": "Unlink",
    "item.relations.parent": "Parent topic",
    "item.relations.siblings": "Siblings",
    "item.relations.none": "None",

    "item.placements.title": "Where this item appears",
    "item.placements.empty": "This item is not placed in any table yet.",
    "item.placements.row": "Row",
    "item.placements.column": "Column",
    "item.placements.moved": "Moved",
    "item.placements.open": "Open table",

    "item.estimate.title": "Planned vs actual",
    "item.estimate.line": "Planned {planned} rounds · done {done} · {left} left",
    "item.estimate.noPlan": "No round estimate set.",

    "item.subtasks.promote": "Convert to task",
    "item.subtasks.promoted": "Converted into a task and linked.",

    "item.shortcuts.hint": "Shortcuts: S start/stop · 1–7 tabs · N new subtask · E edit title",

    "item.ai.title": "AI summary",
    "item.ai.run": "Generate summary",
    "item.ai.running": "Thinking…",
    "item.ai.next": "Suggested next steps",
    "item.ai.failed": "Could not generate the summary",

    "item.due.time": "Due time",
    "item.due.repeat": "Repeat",
    "item.repeat.none": "No repeat",
    "item.repeat.daily": "Daily",
    "item.repeat.weekly": "Weekly",

    "item.links.preview": "Preview",
  },
  ar: {
    "item.bar.running": "قيد التشغيل",
    "item.bar.idle": "متوقّف",

    "item.tab.timeline": "الخط الزمني",
    "item.timeline.empty": "لا يوجد نشاط مسجّل بعد.",
    "item.timeline.session": "جلسة عمل · {duration}",
    "item.timeline.attachment": "أُضيف ملف: {name}",
    "item.timeline.subtaskAdded": "أُضيفت مهمة فرعية: {title}",
    "item.timeline.note": "ملاحظة: {title}",
    "item.timeline.link": "أُضيف رابط: {url}",
    "item.timeline.created": "أُنشئ العنصر",

    "item.autoProgress": "تقدّم تلقائي من المهام الفرعية",
    "item.autoProgressHint": "يتبع التقدّم نسبة المهام الفرعية المنجزة.",

    "item.relations.title": "الروابط بين المهام",
    "item.relations.blockedBy": "يحجبها",
    "item.relations.blocks": "تحجب",
    "item.relations.related": "مرتبطة بـ",
    "item.relations.add": "اربط مهمة…",
    "item.relations.remove": "فكّ الربط",
    "item.relations.parent": "الموضوع الأب",
    "item.relations.siblings": "المهام الشقيقة",
    "item.relations.none": "لا شيء",

    "item.placements.title": "مواضع هذا العنصر",
    "item.placements.empty": "هذا العنصر غير موضوع في أي جدول بعد.",
    "item.placements.row": "الصف",
    "item.placements.column": "العمود",
    "item.placements.moved": "تم النقل",
    "item.placements.open": "فتح الجدول",

    "item.estimate.title": "المخطَّط مقابل الواقع",
    "item.estimate.line": "مخطَّط {planned} جولة · منجز {done} · متبقٍ {left}",
    "item.estimate.noPlan": "لا يوجد تقدير للجولات.",

    "item.subtasks.promote": "تحويل إلى مهمة",
    "item.subtasks.promoted": "تم التحويل إلى مهمة مع الإبقاء على الرابط.",

    "item.shortcuts.hint": "اختصارات: S بدء/إيقاف · 1–7 التبويبات · N مهمة فرعية · E تحرير العنوان",

    "item.ai.title": "ملخّص AI",
    "item.ai.run": "توليد الملخّص",
    "item.ai.running": "جارٍ التفكير…",
    "item.ai.next": "الخطوات المقترحة",
    "item.ai.failed": "تعذّر توليد الملخّص",

    "item.due.time": "وقت التسليم",
    "item.due.repeat": "التكرار",
    "item.repeat.none": "بدون تكرار",
    "item.repeat.daily": "يومي",
    "item.repeat.weekly": "أسبوعي",

    "item.links.preview": "معاينة",
  },
} as const;
