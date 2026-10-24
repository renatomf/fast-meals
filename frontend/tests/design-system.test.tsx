import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Inbox } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { DataTable } from "@/design-system/components/data-table";
import { EmptyState } from "@/design-system/components/empty-state";
import { MetricCard } from "@/design-system/components/metric-card";

type Row = { id: string; name: string };

const columns = [{ id: "name", header: "Nome", cell: (row: Row) => row.name }];

describe("MetricCard", () => {
  it("shows the value and the hint once loaded", () => {
    render(<MetricCard label="Receita" value="R$ 10,00" hint="+5%" tone="positive" />);

    expect(screen.getByText("Receita")).toBeInTheDocument();
    expect(screen.getByText("R$ 10,00")).toBeInTheDocument();
    expect(screen.getByText("+5%")).toHaveClass("text-success");
  });

  it("shows placeholders instead of a value while loading", () => {
    render(<MetricCard label="Receita" value="R$ 10,00" loading />);

    expect(screen.queryByText("R$ 10,00")).not.toBeInTheDocument();
  });
});

describe("DataTable", () => {
  it("renders one row per item and reports clicks", async () => {
    const onRowClick = vi.fn();
    render(
      <DataTable
        columns={columns}
        rows={[
          { id: "1", name: "Ana" },
          { id: "2", name: "Bruno" },
        ]}
        getRowKey={(row) => row.id}
        onRowClick={onRowClick}
      />,
    );

    await userEvent.click(screen.getByText("Bruno"));

    expect(screen.getAllByRole("row")).toHaveLength(3);
    expect(onRowClick).toHaveBeenCalledWith({ id: "2", name: "Bruno" });
  });

  it("shows the screen's empty state when there are no rows", () => {
    render(
      <DataTable
        columns={columns}
        rows={[]}
        getRowKey={(row) => row.id}
        emptyState={<EmptyState icon={Inbox} title="Nenhum pedido" />}
      />,
    );

    expect(screen.getByText("Nenhum pedido")).toBeInTheDocument();
  });
});
