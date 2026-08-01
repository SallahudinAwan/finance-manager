import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";
import { GuidedTour } from "./GuidedTour";

function CurrentPath() {
  return <output aria-label="Current path">{useLocation().pathname}</output>;
}

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
        <MemoryRouter initialEntries={["/app/settings"]}>
          <CurrentPath />
          <GuidedTour open isOwner onClose={onClose} />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText("Your monthly money has a clear flow now")).toBeVisible();
    expect(screen.getByText("Step 1 of 19")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Begin each visit with the big picture")).toBeVisible();
    await waitFor(() => expect(screen.getByLabelText("Current path")).toHaveTextContent("/app"));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Read these four numbers together")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByText("Begin each visit with the big picture")).toBeVisible();
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

  it("includes dedicated household obligation and savings bucket steps", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/app"]}>
          <GuidedTour open isOwner onClose={vi.fn()} />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    for (let index = 0; index < 6; index += 1) {
      fireEvent.click(screen.getByRole("button", { name: "Next" }));
    }
    expect(screen.getByText("Track every household expense against its plan")).toBeVisible();

    for (let index = 0; index < 4; index += 1) {
      fireEvent.click(screen.getByRole("button", { name: "Next" }));
    }
    expect(screen.getByText("See how your reserved money is distributed")).toBeVisible();
  });
});
