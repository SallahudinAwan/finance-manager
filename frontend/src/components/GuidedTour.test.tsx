import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GuidedTour } from "./GuidedTour";

describe("GuidedTour", () => {
  it("walks through steps and remembers when the user skips it", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          preferred_language: "en",
          tour_completed: true,
          updated_at: "2026-07-30T00:00:00Z",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const onClose = vi.fn();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <GuidedTour open onClose={onClose} />
      </QueryClientProvider>,
    );

    expect(screen.getByText("Your finances, in one calm place")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("See the important numbers first")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Skip guided tour" }));

    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/preferences/",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ tour_completed: true }),
      }),
    );
  });
});
