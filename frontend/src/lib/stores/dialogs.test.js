import { describe, expect, it } from "vitest";
import { get } from "svelte/store";
import { createDialogState, positionContextMenu } from "./dialogs";

describe("positionContextMenu", () => {
  it("deja el menú donde está si cabe", () => {
    expect(positionContextMenu(10, 20)).toEqual({ x: 10, y: 20 });
  });

  it("voltea a la izquierda si se sale por la derecha", () => {
    // 400 + 160 > 480
    expect(positionContextMenu(400, 20)).toEqual({ x: 240, y: 20 });
  });

  it("voltea hacia arriba si se sale por abajo", () => {
    // 750 + 120 > 800
    expect(positionContextMenu(10, 750)).toEqual({ x: 10, y: 630 });
  });

  it("admite límites y tamaño de menú distintos", () => {
    expect(
      positionContextMenu(100, 100, {
        menuWidth: 50,
        menuHeight: 40,
        limitWidth: 120,
        limitHeight: 120,
      }),
    ).toEqual({ x: 50, y: 60 });
  });
});

describe("createDialogState", () => {
  it("abre el menú contextual con la posición corregida", () => {
    const dialogs = createDialogState();
    const item = { id: "x" };

    dialogs.openContextMenu(item, 400, 750);

    expect(get(dialogs.contextMenu)).toEqual({
      open: true,
      x: 240,
      y: 630,
      item,
    });
  });

  it("cerrar el menú conserva posición e item", () => {
    const dialogs = createDialogState();
    dialogs.openContextMenu({ id: "x" }, 10, 20);

    dialogs.closeContextMenu();

    const menu = get(dialogs.contextMenu);
    expect(menu.open).toBe(false);
    expect(menu.x).toBe(10);
    expect(menu.y).toBe(20);
    expect(menu.item).toEqual({ id: "x" });
  });

  it("la preview conserva el item al cerrarse", () => {
    const dialogs = createDialogState();
    const item = { id: "x", thumbnail: "/local-asset/x.png" };

    dialogs.openPreview(item);
    expect(get(dialogs.previewOpen)).toBe(true);
    expect(get(dialogs.previewItem)).toBe(item);

    dialogs.closePreview();
    expect(get(dialogs.previewOpen)).toBe(false);
    expect(get(dialogs.previewItem)).toBe(item);
  });

  it("pide y cierra el diálogo de borrado", () => {
    const dialogs = createDialogState();
    const item = { id: "x" };

    dialogs.requestDelete(item);
    expect(get(dialogs.deleteOpen)).toBe(true);
    expect(get(dialogs.itemToDelete)).toBe(item);

    dialogs.closeDelete();
    expect(get(dialogs.deleteOpen)).toBe(false);
  });
});
