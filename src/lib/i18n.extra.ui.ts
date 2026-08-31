/**
 * Shared UI chrome strings (pagination, sticky notes, stat strips, editor
 * spacing controls) so every surface is fully translated in both languages.
 */
export const uiMessages = {
  en: {
    "ui.pagination.label": "Pagination",
    "ui.pagination.summary": "Page {page} of {pageCount} · {total} items",
    "ui.pagination.previous": "Previous page",
    "ui.pagination.next": "Next page",
    "ui.pagination.page": "Page {page}",

    "ui.notes.region": "Page sticky notes",
    "ui.notes.add": "Add page sticky note",
    "ui.notes.arrange": "Arrange sticky notes",
    "ui.notes.delete": "Delete sticky note",
    "ui.notes.title": "Sticky note",
    "ui.notes.placeholder": "Write a note…",
    "ui.notes.text": "Sticky note text",
    "ui.notes.loadFailed": "Could not load page notes.",
    "ui.notes.createFailed": "Could not create the sticky note.",
    "ui.notes.arrangeFailed": "Could not arrange the notes.",
    "ui.notes.positionFailed": "Could not save the note position.",
    "ui.notes.saveFailed": "Could not save the sticky note.",

    "ui.editor.lineSpacing": "Line spacing",
    "ui.editor.paragraphSpacing": "Paragraph spacing",

    "ui.stats.entries": "Entries",
    "ui.stats.notes": "Notes",
    "ui.stats.files": "Files",
    "ui.stats.sessions": "Sessions",
    "ui.stats.avgProgress": "Avg progress",
    "ui.stats.focusRounds": "Focus rounds",
    "ui.stats.tracked": "Tracked",

    "ui.item.roundsTracked": "{rounds} rounds · {time}",
  },
  ar: {
    "ui.pagination.label": "ترقيم الصفحات",
    "ui.pagination.summary": "صفحة {page} من {pageCount} · {total} عنصر",
    "ui.pagination.previous": "الصفحة السابقة",
    "ui.pagination.next": "الصفحة التالية",
    "ui.pagination.page": "صفحة {page}",

    "ui.notes.region": "الملاحظات اللاصقة",
    "ui.notes.add": "إضافة ملاحظة لاصقة",
    "ui.notes.arrange": "ترتيب الملاحظات",
    "ui.notes.delete": "حذف الملاحظة",
    "ui.notes.title": "ملاحظة لاصقة",
    "ui.notes.placeholder": "اكتب ملاحظة…",
    "ui.notes.text": "نص الملاحظة",
    "ui.notes.loadFailed": "تعذّر تحميل الملاحظات.",
    "ui.notes.createFailed": "تعذّر إنشاء الملاحظة.",
    "ui.notes.arrangeFailed": "تعذّر ترتيب الملاحظات.",
    "ui.notes.positionFailed": "تعذّر حفظ موضع الملاحظة.",
    "ui.notes.saveFailed": "تعذّر حفظ الملاحظة.",

    "ui.editor.lineSpacing": "تباعد الأسطر",
    "ui.editor.paragraphSpacing": "تباعد الفقرات",

    "ui.stats.entries": "السجلات",
    "ui.stats.notes": "الملاحظات",
    "ui.stats.files": "الملفات",
    "ui.stats.sessions": "الجلسات",
    "ui.stats.avgProgress": "متوسط التقدم",
    "ui.stats.focusRounds": "جولات التركيز",
    "ui.stats.tracked": "الوقت المسجل",

    "ui.item.roundsTracked": "{rounds} جولة · {time}",
  },
} as const;
