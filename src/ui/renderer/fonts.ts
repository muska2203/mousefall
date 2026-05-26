/**
 * Шрифты для PixiJS Text.
 * Должны совпадать с CSS-переменными проекта:
 *   --font-ui: system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
 *   --font-panel-title: "Cinzel", "Palatino Linotype", Palatino, Georgia, serif;
 *
 * PixiJS не читает CSS-переменные, поэтому дублируем здесь строкой.
 * Чтобы шрифт точно загрузился к моменту создания Text,
 * PixiApp.mount() ждёт document.fonts.ready.
 */

export const FONT_UI = 'system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
export const FONT_PANEL_TITLE = '"Cinzel", "Palatino Linotype", Palatino, Georgia, serif';
