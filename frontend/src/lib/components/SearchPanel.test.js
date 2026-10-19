import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/svelte";

// El componente solo usa `gower.search` y `mapThumbnails`; el resto de
// dependencias de WallpaperGrid se doblan para no tocar el binding de Wails.
vi.mock("$lib/api", () => ({
    gower: { search: vi.fn() },
    mapThumbnails: (items) => items,
    normalizeId: (id) => String(id),
    checkFileExists: vi.fn().mockReturnValue(false),
}));

import { gower } from "$lib/api";
import SearchPanel from "./SearchPanel.svelte";

/** Escribe el término y pulsa Buscar, que es el único disparador del fetch. */
async function searchFor(term) {
    await fireEvent.input(screen.getByRole("textbox"), {
        target: { value: term },
    });
    await fireEvent.click(screen.getByRole("button"));
}

describe("SearchPanel", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("no lanza ninguna búsqueda al montar la pestaña", () => {
        render(SearchPanel);

        expect(gower.search).not.toHaveBeenCalled();
        expect(screen.queryByRole("alert")).toBeNull();
    });

    it("muestra el error del proveedor en vez de 'sin resultados'", async () => {
        gower.search.mockRejectedValueOnce(
            new Error("wallhaven rate limit exceeded"),
        );

        render(SearchPanel);
        await searchFor("cyberpunk");

        const alert = await screen.findByRole("alert");
        expect(alert.textContent).toContain("wallhaven rate limit exceeded");
        // El estado vacío mentía: un fallo no es "no hay resultados".
        expect(
            screen.queryByText(/No results found|No se encontraron resultados/),
        ).toBeNull();
    });

    it("limpia el aviso cuando la siguiente búsqueda funciona", async () => {
        gower.search.mockRejectedValueOnce(new Error("boom"));

        render(SearchPanel);
        await searchFor("cyberpunk");
        await screen.findByRole("alert");

        gower.search.mockResolvedValueOnce([]);
        await searchFor("cyberpunk");

        await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    });

    it("no consulta al sidecar con el término vacío", async () => {
        render(SearchPanel);
        await fireEvent.click(screen.getByRole("button"));

        expect(gower.search).not.toHaveBeenCalled();
    });
});
