import React from "react";
import { Pagination, PaginationItem, PaginationLink } from "reactstrap";

const CustomPagination = ({ currentPage, totalPages, onPageChange }) => {
  const pageNumbers = [];
  const maxVisiblePages = 6;
  const halfVisible = Math.floor(maxVisiblePages / 2);

  let startPage = Math.max(1, currentPage - halfVisible);
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

  if (endPage - startPage + 1 < maxVisiblePages) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    pageNumbers.push(i);
  }

  return (
    <div className="d-flex justify-content-end mt-3">
      <Pagination aria-label="Page navigation">
        <PaginationItem disabled={currentPage === 1}>
          <PaginationLink
            previous
            onClick={() => onPageChange(currentPage - 1)}
            style={{
              border: "1px solid #dee2e6",
              color: currentPage === 1 ? "#6c757d" : "#6d5b98",
              backgroundColor: "transparent",
              padding: "4px 8px",
              fontWeight: "500",
            }}
          >
            Previous
          </PaginationLink>
        </PaginationItem>

        {pageNumbers.map((number) => (
          <PaginationItem key={number} active={number === currentPage}>
            <PaginationLink
              onClick={() => onPageChange(number)}
              style={{
                border: "1px solid #dee2e6",
                backgroundColor: number === currentPage ? "#6d5b98" : "transparent",
                color: number === currentPage ? "#ffffff" : "#6d5b98",
                padding: "4px 8px",
                fontWeight: "500",
                minWidth: "28px",
                textAlign: "center",
              }}
            >
              {number}
            </PaginationLink>
          </PaginationItem>
        ))}

        <PaginationItem disabled={currentPage === totalPages}>
          <PaginationLink
            next
            onClick={() => onPageChange(currentPage + 1)}
            style={{
              border: "1px solid #dee2e6",
              color: currentPage === totalPages ? "#6c757d" : "#6d5b98",
              backgroundColor: "transparent",
              padding: "4px 8px",
              fontWeight: "500",
            }}
          >
            Next
          </PaginationLink>
        </PaginationItem>
      </Pagination>
    </div>
  );
};

export default CustomPagination;