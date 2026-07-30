import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { I18nProvider, useI18n } from "./i18n";

function Example() {
  const { direction, language, t } = useI18n();
  return (
    <div>
      <h1>Overview</h1>
      <input aria-label="Choose month" placeholder="Description" />
      <span>{t("Savings")}</span>
      <output>{language}:{direction}</output>
    </div>
  );
}

describe("I18nProvider", () => {
  it("applies Urdu translations, locale metadata, and right-to-left direction", async () => {
    render(
      <I18nProvider language="ur">
        <Example />
      </I18nProvider>,
    );

    await waitFor(() => expect(screen.getByRole("heading")).toHaveTextContent("جائزہ"));
    expect(screen.getByText("بچت")).toBeVisible();
    expect(screen.getByLabelText("مہینہ منتخب کریں")).toHaveAttribute(
      "placeholder",
      "تفصیل",
    );
    expect(screen.getByText("ur:rtl")).toBeVisible();
    expect(document.documentElement).toHaveAttribute("lang", "ur");
    expect(document.documentElement).toHaveAttribute("dir", "rtl");
  });

  it("keeps the English source copy in left-to-right mode", () => {
    render(
      <I18nProvider language="en">
        <Example />
      </I18nProvider>,
    );

    expect(screen.getByRole("heading")).toHaveTextContent("Overview");
    expect(screen.getByLabelText("Choose month")).toHaveAttribute(
      "placeholder",
      "Description",
    );
    expect(screen.getByText("en:ltr")).toBeVisible();
    expect(document.documentElement).toHaveAttribute("lang", "en");
    expect(document.documentElement).toHaveAttribute("dir", "ltr");
  });
});
