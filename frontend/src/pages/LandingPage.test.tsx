import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LandingPage } from "./LandingPage";

describe("LandingPage", () => {
  it("presents the Ravani monthly money brand", () => {
    render(<LandingPage />);

    expect(screen.getByRole("link", { name: /Ravani/ })).toHaveAttribute("href", "/");
    expect(screen.getByText("روانی")).toBeInTheDocument();
    expect(screen.getByText("Har maah, har rupay ka hisaab")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Give every rupee a path\.\s*Own the whole month\./,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Ravani · Monthly Money Manager")).toBeInTheDocument();
    expect(screen.getByText("Sample data")).toBeInTheDocument();
    expect(screen.getByText("4-user demo household")).toBeInTheDocument();
    expect(screen.getByText("Rs275,800")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Try it with your numbers/ })).toHaveAttribute(
      "href",
      expect.stringContaining("/accounts/google/login/"),
    );
    expect(screen.queryByText("Finance Manager")).not.toBeInTheDocument();
  });
});
