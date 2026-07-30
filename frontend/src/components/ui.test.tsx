import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState, ProgressBar } from "./ui";

describe("shared interface states", () => {
  it("renders an accessible progress bar with clamped values", () => {
    render(<ProgressBar value={135} max={100} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  });

  it("renders helpful empty-state copy", () => {
    render(
      <EmptyState
        icon={<span aria-hidden="true">—</span>}
        title="No transactions yet"
        description="Your activity will appear here."
      />,
    );
    expect(screen.getByText("No transactions yet")).toBeVisible();
    expect(screen.getByText("Your activity will appear here.")).toBeVisible();
  });
});
