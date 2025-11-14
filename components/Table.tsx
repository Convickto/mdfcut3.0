import React from 'react';

interface TableProps<T> {
  data: T[];
  columns: {
    header: string;
    accessor: keyof T | ((row: T) => React.ReactNode);
    className?: string;
  }[];
  keyExtractor: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  className?: string;
}

const Table = <T extends object>({
  data,
  columns,
  keyExtractor,
  onRowClick,
  emptyMessage = 'Nenhum dado para exibir.',
  className = '',
}: TableProps<T>): React.ReactElement => {
  if (!data || data.length === 0) {
    return (
      <div className="p-4 text-center text-gray-600 border border-gray-300 rounded-lg bg-white shadow-sm">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={`overflow-x-auto rounded-lg shadow-md ${className}`}>
      <table className="min-w-full bg-white border border-gray-200">
        <thead className="bg-blue-600 text-white">
          <tr>
            {columns.map((col, index) => (
              <th
                key={index}
                className={`py-3 px-4 text-left text-sm font-medium ${col.className || ''}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {data.map((row) => (
            <tr
              key={keyExtractor(row)}
              className={`hover:bg-gray-50 ${onRowClick ? 'cursor-pointer' : ''}`}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((col, colIndex) => (
                <td
                  key={colIndex}
                  className={`py-3 px-4 text-sm text-gray-800 whitespace-nowrap ${col.className || ''}`}
                >
                  {typeof col.accessor === 'function'
                    ? col.accessor(row)
                    : (row[col.accessor] as React.ReactNode)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Table;
