import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SortableTable from '../SortableTable';

interface TestData {
  id: string;
  name: string;
  status: string;
  created: string;
}

describe('SortableTable', () => {
  const mockData: TestData[] = [
    { id: '1', name: 'Project A', status: 'active', created: '2024-01-01' },
    { id: '2', name: 'Project B', status: 'inactive', created: '2024-01-02' },
    { id: '3', name: 'Project C', status: 'active', created: '2024-01-03' },
  ];

  const columns = [
    {
      key: 'name' as keyof TestData,
      label: 'Name',
      sortable: true,
    },
    {
      key: 'status' as keyof TestData,
      label: 'Status',
      sortable: true,
    },
    {
      key: 'created' as keyof TestData,
      label: 'Created',
      sortable: true,
    },
  ];

  it('should render table with data', () => {
    render(<SortableTable data={mockData} columns={columns} />);

    expect(screen.getByText('Project A')).toBeInTheDocument();
    expect(screen.getByText('Project B')).toBeInTheDocument();
    expect(screen.getByText('Project C')).toBeInTheDocument();
  });

  it('should render empty message when no data', () => {
    render(<SortableTable data={[]} columns={columns} emptyMessage="No data found" />);

    expect(screen.getByText('No data found')).toBeInTheDocument();
  });

  it('should sort ascending when clicking sortable column header', async () => {
    const user = userEvent.setup();
    render(<SortableTable data={mockData} columns={columns} />);

    const nameHeader = screen.getByText('Name');
    await user.click(nameHeader);

    const rows = screen.getAllByRole('row');
    // First row is header, check data rows
    expect(rows[1]).toHaveTextContent('Project A');
    expect(rows[2]).toHaveTextContent('Project B');
    expect(rows[3]).toHaveTextContent('Project C');
  });

  it('should sort descending on second click', async () => {
    const user = userEvent.setup();
    render(<SortableTable data={mockData} columns={columns} />);

    const nameHeader = screen.getByText('Name');
    await user.click(nameHeader); // First click - ascending
    await user.click(nameHeader); // Second click - descending

    const rows = screen.getAllByRole('row');
    expect(rows[1]).toHaveTextContent('Project C');
    expect(rows[2]).toHaveTextContent('Project B');
    expect(rows[3]).toHaveTextContent('Project A');
  });

  it('should remove sort on third click', async () => {
    const user = userEvent.setup();
    render(<SortableTable data={mockData} columns={columns} />);

    const nameHeader = screen.getByText('Name');
    await user.click(nameHeader); // First click - ascending
    await user.click(nameHeader); // Second click - descending
    await user.click(nameHeader); // Third click - no sort

    // Should return to original order
    const rows = screen.getAllByRole('row');
    expect(rows[1]).toHaveTextContent('Project A');
    expect(rows[2]).toHaveTextContent('Project B');
    expect(rows[3]).toHaveTextContent('Project C');
  });

  it('should call onRowClick when row is clicked', async () => {
    const user = userEvent.setup();
    const handleRowClick = jest.fn();
    render(<SortableTable data={mockData} columns={columns} onRowClick={handleRowClick} />);

    const rows = screen.getAllByRole('row');
    await user.click(rows[1]); // Click first data row

    expect(handleRowClick).toHaveBeenCalledWith(mockData[0]);
  });

  it('should use custom render function for columns', () => {
    const columnsWithRender = [
      {
        key: 'name' as keyof TestData,
        label: 'Name',
        sortable: true,
        render: (value: string) => <span data-testid="custom-name">{value.toUpperCase()}</span>,
      },
    ];

    render(<SortableTable data={mockData} columns={columnsWithRender} />);

    const customNames = screen.getAllByTestId('custom-name');
    expect(customNames[0]).toHaveTextContent('PROJECT A');
    expect(customNames[1]).toHaveTextContent('PROJECT B');
    expect(customNames[2]).toHaveTextContent('PROJECT C');
  });

  it('should not sort non-sortable columns', async () => {
    const user = userEvent.setup();
    const columnsWithNonSortable = [
      {
        key: 'name' as keyof TestData,
        label: 'Name',
        sortable: false,
      },
    ];

    render(<SortableTable data={mockData} columns={columnsWithNonSortable} />);

    const nameHeader = screen.getByText('Name');
    await user.click(nameHeader);

    // Should not change order
    const rows = screen.getAllByRole('row');
    expect(rows[1]).toHaveTextContent('Project A');
  });

  it('should handle date sorting', async () => {
    const user = userEvent.setup();
    render(<SortableTable data={mockData} columns={columns} />);

    const createdHeader = screen.getByText('Created');
    await user.click(createdHeader);

    const rows = screen.getAllByRole('row');
    expect(rows[1]).toHaveTextContent('Project A'); // 2024-01-01
    expect(rows[2]).toHaveTextContent('Project B'); // 2024-01-02
    expect(rows[3]).toHaveTextContent('Project C'); // 2024-01-03
  });
});

