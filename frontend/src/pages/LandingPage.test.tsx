import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LandingPage } from "./LandingPage";

describe("LandingPage", () => {
  it("presents the Ravani monthly money brand", () => {
    render(<LandingPage />);

    expect(screen.getByRole("link", { name: /Ravani/ })).toHaveAttribute("href", "/");
    expect(screen.getByText("روانی")).toBeVisible();
    expect(screen.getByText("Har maah, har rupay ka hisaab")).toBeVisible();
    expect(
      screen.getByRole("heading", {
        name: /Give every rupee a path\.\s*Own the whole month\./,
      }),
    ).toBeVisible();
    expect(screen.getByText("Ravani · Monthly Money Manager")).toBeVisible();
    expect(screen.queryByText("Finance Manager")).not.toBeInTheDocument();
  });
});
