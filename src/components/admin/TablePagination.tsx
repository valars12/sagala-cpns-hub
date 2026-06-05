import { Button } from "@/components/ui/button";

const PAGE_BUTTON_WINDOW = 5;

type TablePaginationProps = {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
};

const buildPageButtons = (currentPage: number, totalPages: number) => {
  if (totalPages <= PAGE_BUTTON_WINDOW) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, totalPages]);
  const siblingCount = 1;

  for (
    let page = currentPage - siblingCount;
    page <= currentPage + siblingCount;
    page += 1
  ) {
    if (page > 1 && page < totalPages) {
      pages.add(page);
    }
  }

  return Array.from(pages).sort((a, b) => a - b);
};

const TablePagination = ({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}: TablePaginationProps) => {
  if (totalItems <= pageSize) return null;

  const safePage = Math.min(Math.max(currentPage, 1), totalPages);
  const startItem = (safePage - 1) * pageSize + 1;
  const endItem = Math.min(safePage * pageSize, totalItems);
  const pageButtons = buildPageButtons(safePage, totalPages);

  return (
    <div className="flex flex-col items-start justify-between gap-3 border-t border-border/50 px-4 py-4 sm:flex-row sm:items-center">
      <p className="text-sm text-muted-foreground">
        Menampilkan {startItem}-{endItem} dari {totalItems} data
      </p>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
        >
          Sebelumnya
        </Button>

        {pageButtons.map((page, index) => {
          const previous = pageButtons[index - 1];
          const showEllipsis = previous !== undefined && page - previous > 1;

          return (
            <div key={page} className="flex items-center gap-1">
              {showEllipsis ? (
                <span className="px-1 text-sm text-muted-foreground">...</span>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant={page === safePage ? "default" : "outline"}
                className="min-w-9 px-3"
                onClick={() => onPageChange(page)}
              >
                {page}
              </Button>
            </div>
          );
        })}

        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(safePage + 1)}
        >
          Berikutnya
        </Button>
      </div>
    </div>
  );
};

export default TablePagination;
