import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "./table";

describe("Table", () => {
  it("renders a table element", () => {
    render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>Cell</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
    expect(screen.getByText("Cell")).toBeInTheDocument();
  });

  it("renders headers and rows", () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>John</TableCell>
            <TableCell>john@test.com</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByText("John")).toBeInTheDocument();
    expect(screen.getByText("john@test.com")).toBeInTheDocument();
  });

  it("renders multiple rows", () => {
    render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>Row 1</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Row 2</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
    expect(screen.getByText("Row 1")).toBeInTheDocument();
    expect(screen.getByText("Row 2")).toBeInTheDocument();
  });
});
