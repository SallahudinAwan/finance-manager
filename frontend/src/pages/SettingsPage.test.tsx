import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SavingsTargetForm } from "./SettingsPage";

describe("SavingsTargetForm", () => {
  it("updates the household monthly savings target", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ monthly_savings_target: "175000.00" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const onSaved = vi.fn().mockResolvedValue(undefined);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <SavingsTargetForm target="150000.00" onSaved={onSaved} />
      </QueryClientProvider>,
    );

    const amount = screen.getByLabelText("Fixed monthly savings target");
    expect(amount).toHaveValue(150000);
    fireEvent.change(amount, { target: { value: "175000.00" } });
    fireEvent.click(screen.getByRole("button", { name: "Update monthly savings" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/household/",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ monthly_savings_target: "175000.00" }),
      }),
    );
  });
});
