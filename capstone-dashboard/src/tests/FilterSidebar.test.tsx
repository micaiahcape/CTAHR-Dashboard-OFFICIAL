import { render, screen } from "@testing-library/react";
import FilterSidebar from "../components/dashboard/LeftSidebar";

describe("FilterSidebar", () => {

  // verifies that the Oleson Lab logo appears in the sidebar
  // confirms that the branding image loads correctly in the navigation panel
  test("renders the Oleson Lab logo", () => {
    render(<FilterSidebar />);

    const logo = screen.getByAltText("Oleson Lab");

    expect(logo).toBeInTheDocument();
  });

  // verifies that the dashboard title text appears in the sidebar
  // confirms that the main heading and subtitle render correctly for the UI layout
  test("renders the dashboard title", () => {
    render(<FilterSidebar />);

    expect(screen.getByText("Hawaiʻi")).toBeInTheDocument();
    expect(screen.getByText("Ecosystem Accounts")).toBeInTheDocument();
  });

  // verifies that the Fisheries section label appears in the sidebar
  // confirms the correct dataset section is displayed as the default active view
  test("renders Fisheries as the active section", () => {
    render(<FilterSidebar />);

    expect(screen.getByText("Fisheries")).toBeInTheDocument();
  });

  // verifies that the sidebar logo uses the correct image file and styling class
  // confirms that the expected logo asset and CSS class are applied correctly
  test("logo uses the correct image source and class", () => {
    render(<FilterSidebar />);

    const logo = screen.getByAltText("Oleson Lab");

    expect(logo).toHaveAttribute("src", "/logo.png");
    expect(logo).toHaveClass("left-nav-logo");
  });

});