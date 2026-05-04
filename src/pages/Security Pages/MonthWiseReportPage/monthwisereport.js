import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Card,
  CardBody,
  Row,
  Col,
  Label,
  Button,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Table,
} from "reactstrap";
import Flatpickr from "react-flatpickr";
import { MDBDataTable } from "mdbreact";
import axios from "axios";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import CustomPagination from "../CustomPagination"; // Adjust path if necessary
import "./monthwisereport.css";

const MonthWiseReport = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const baseURL = "https://security-project-pe9c.onrender.com";
  const today = new Date();
  const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const currentMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const deduplicateEmployees = (employees) => {
    if (!Array.isArray(employees)) return [];
    const seen = new Set();
    return employees.filter((emp) => {
      const idStr = String(emp?.id ?? "");
      if (seen.has(idStr)) {
        console.warn(`Duplicate employee ID found: ${idStr}, Name: ${emp?.name ?? "Unknown"}`);
        return false;
      }
      seen.add(idStr);
      return true;
    });
  };

  const [searchTerm, setSearchTerm] = useState(location.state?.searchTerm || "");
  const [fromDate, setFromDate] = useState(location.state?.fromDate || currentMonthStart);
  const [toDate, setToDate] = useState(location.state?.toDate || currentMonthEnd);
  const [allEmployees, setAllEmployees] = useState(
    deduplicateEmployees(location.state?.allEmployees ?? [])
  );
  const [filteredRows, setFilteredRows] = useState(
    deduplicateEmployees(location.state?.filteredRows ?? [])
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [downloadFormat, setDownloadFormat] = useState("pdf");
  const [entries, setEntries] = useState(10);
  const [modal, setModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const countWeekOffDays = (startDate, endDate, weekOffDay) => {
    if (!weekOffDay) return 0;
    let count = 0;
    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      if (currentDate.toLocaleString("en-US", { weekday: "long" }) === weekOffDay) {
        count++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return count;
  };

  const fetchEmployeeDetails = async (empId) => {
    try {
      const response = await axios.get(`${baseURL}/emp/details`);
      const emp = response.data.find((e) => String(e.empId) === String(empId));
      const employeeDetails = emp || {
        empId: empId,
        empName: `Unknown Employee ${empId}`,
        empDesignation: "N/A",
        empMobileNo: "N/A",
        empAadharNo: "N/A",
        empPanNo: "N/A",
        empDob: "N/A",
        empDoj: "N/A",
        empDepartment: "N/A",
        empAddress: "N/A",
        empBankAccountNo: "N/A",
        empEpfNo: "N/A",
        empEsiNo: "N/A",
        empWeekOff: "Sunday",
      };
      console.log(`Fetched details for empId ${empId}:`, employeeDetails);
      return employeeDetails;
    } catch (err) {
      console.error("Error fetching employee details:", err);
      return {
        empId: empId,
        empName: `Unknown Employee ${empId}`,
        empDesignation: "N/A",
        empMobileNo: "N/A",
        empAadharNo: "N/A",
        empPanNo: "N/A",
        empDob: "N/A",
        empDoj: "N/A",
        empDepartment: "N/A",
        empAddress: "N/A",
        empBankAccountNo: "N/A",
        empEpfNo: "N/A",
        empEsiNo: "N/A",
        empWeekOff: "Sunday",
      };
    }
  };

  const fetchRemainingCLs = async (empId) => {
    try {
      const response = await axios.get(`${baseURL}/leaves/remaining-cl/${empId}`, {
        params: { startDate: formatDate(fromDate), endDate: formatDate(toDate) },
      });
      return response.data.remainingCL || 0;
    } catch (err) {
      console.error(`Error fetching remaining CLs for empId ${empId}:`, err);
      return 0;
    }
  };

  const fetchMonthWiseReport = async (empId, startDate, endDate) => {
    try {
      const response = await axios.get(`${baseURL}/month/monthwise-report/${empId}`, {
        params: { startDate: formatDate(startDate), endDate: formatDate(endDate) },
      });
      console.log(`MonthWise Report for empId ${empId}:`, response.data);

      const { combinedReport } = response.data;
      if (!combinedReport || typeof combinedReport !== "object") {
        console.warn(`Invalid combinedReport for empId ${empId}:`, combinedReport);
        return { present: 0, absent: 0, leaveDays: 0, od: 0 };
      }

      const startYear = startDate.getFullYear();
      const startMonth = startDate.getMonth() + 1;
      const endYear = endDate.getFullYear();
      const endMonth = endDate.getMonth() + 1;

      let present = 0,
        absent = 0,
        leaveDays = 0,
        od = 0;

      if (Array.isArray(combinedReport.attendance)) {
        combinedReport.attendance.forEach((entry) => {
          const entryYear = entry._id.year;
          const entryMonth = entry._id.month;
          if (
            (entryYear > startYear || (entryYear === startYear && entryMonth >= startMonth)) &&
            (entryYear < endYear || (entryYear === endYear && entryMonth <= endMonth))
          ) {
            present += entry.present || 0;
            absent += entry.absent || 0;
          }
        });
      }

      if (Array.isArray(combinedReport.leaves)) {
        combinedReport.leaves.forEach((entry) => {
          const entryYear = entry._id.year;
          const entryMonth = entry._id.month;
          if (
            (entryYear > startYear || (entryYear === startYear && entryMonth >= startMonth)) &&
            (entryYear < endYear || (entryYear === endYear && entryMonth <= endMonth))
          ) {
            leaveDays += entry.totalLeaves || 0;
          }
        });
      }

      if (Array.isArray(combinedReport.ods)) {
        combinedReport.ods.forEach((entry) => {
          const entryYear = entry._id.year;
          const entryMonth = entry._id.month;
          if (
            (entryYear > startYear || (entryYear === startYear && entryMonth >= startMonth)) &&
            (entryYear < endYear || (entryYear === endYear && entryMonth <= endMonth))
          ) {
            od += entry.totalOds || 0;
          }
        });
      }

      console.log(`Processed data for empId ${empId}:`, { present, absent, leaveDays, od });
      return { present, absent, leaveDays, od };
    } catch (err) {
      console.error(`Error in fetchMonthWiseReport for empId ${empId}:`, err);
      return { present: 0, absent: 0, leaveDays: 0, od: 0 };
    }
  };

  const fetchEmployeeData = async () => {
    setLoading(true);
    setError(null);
    try {
      const empIds = (await axios.get(`${baseURL}/emp/details`)).data.map((e) => String(e.empId));
      if (empIds.length === 0) {
        setError("No employee data available.");
        setLoading(false);
        return;
      }
      const employees = await Promise.all(
        empIds.map(async (empId) => {
          const report = await fetchMonthWiseReport(empId, fromDate, toDate);
          const empDetails = await fetchEmployeeDetails(empId);
          const remainingCL = await fetchRemainingCLs(empId);
          return {
            id: empId,
            name: empDetails.empName,
            present: report.present,
            absent: report.absent,
            leaveDays: report.leaveDays,
            weekOff: countWeekOffDays(fromDate, toDate, empDetails.empWeekOff),
            remainingCL: remainingCL,
            od: report.od,
          };
        })
      );
      const deduplicatedEmployees = deduplicateEmployees(employees);
      console.log("Fetched and processed employees:", deduplicatedEmployees);
      setAllEmployees(deduplicatedEmployees);
      setFilteredRows(deduplicatedEmployees);
    } catch (err) {
      console.error("Error in fetchEmployeeData:", err);
      setError("Failed to fetch employee data.");
      setAllEmployees([]);
      setFilteredRows([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    const d = new Date(date);
    return d.toISOString().split("T")[0];
  };

  const toggleModal = () => setModal(!modal);

  const showEmployeeDetails = async (empId) => {
    const empDetails = await fetchEmployeeDetails(empId);
    setSelectedEmployee(empDetails);
    toggleModal();
  };

  useEffect(() => {
    if (!location.state || !location.state.allEmployees) {
      fetchEmployeeData();
    } else {
      setSearchTerm(location.state.searchTerm || "");
      setFromDate(location.state.fromDate || currentMonthStart);
      setToDate(location.state.toDate || currentMonthEnd);
      setAllEmployees(deduplicateEmployees(location.state.allEmployees ?? []));
      setFilteredRows(deduplicateEmployees(location.state.filteredRows ?? []));
      fetchEmployeeData();
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [location.state]);

  useEffect(() => {
    fetchEmployeeData();
  }, [fromDate, toDate]);

  useEffect(() => {
    let filtered = [...(allEmployees ?? [])];
    if (fromDate && toDate) {
      filtered = filtered.filter((emp) => true);
    }
    if (searchTerm.trim() !== "") {
      filtered = filtered.filter(
        (emp) =>
          emp?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          emp?.id?.toString().includes(searchTerm.toLowerCase())
      );
    }
    setFilteredRows(deduplicateEmployees(filtered));
    setCurrentPage(1);
  }, [searchTerm, fromDate, toDate, allEmployees]);

  useEffect(() => {
    const totalRows = filteredRows.length;
    const calculatedTotalPages = Math.ceil(totalRows / entries);
    setTotalPages(calculatedTotalPages || 1);
    if (currentPage > calculatedTotalPages && calculatedTotalPages > 0) {
      setCurrentPage(calculatedTotalPages);
    }
  }, [filteredRows, entries, currentPage]);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const startIndex = (currentPage - 1) * entries;
  const endIndex = startIndex + entries;
  const paginatedRows = filteredRows.slice(startIndex, endIndex);

  const downloadData = () => {
    const dataToDownload = filteredRows.length > 0 ? filteredRows : allEmployees;
    const headers = [
      "ID",
      "Name",
      "Present Days",
      "Absent Days",
      "Leave Days",
      "Week Off",
      "Remaining CLs",
      "OD",
    ];
    const data = dataToDownload.map((row) => [
      row.id,
      row.name,
      row.present,
      row.absent,
      row.leaveDays,
      row.weekOff,
      row.remainingCL,
      row.od,
    ]);
    if (downloadFormat === "pdf") {
      try {
        const doc = new jsPDF();
        autoTable(doc, { head: [headers], body: data, startY: 20 });
        doc.save(`month_wise_report_${formatDate(fromDate)}_to_${formatDate(toDate)}.pdf`);
      } catch (err) {
        console.error("PDF generation error:", err);
        alert("Failed to generate PDF. Check console for details.");
      }
    } else if (downloadFormat === "excel") {
      try {
        const worksheetData = dataToDownload.map((row) => ({
          ID: row.id,
          Name: row.name,
          "Present Days": row.present,
          "Absent Days": row.absent,
          "Leave Days": row.leaveDays,
          "Week Off": row.weekOff,
          "Remaining CLs": row.remainingCL,
          OD: row.od,
        }));
        const worksheet = XLSX.utils.json_to_sheet(worksheetData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "MonthWiseReport");
        XLSX.writeFile(
          workbook,
          `month_wise_report_${formatDate(fromDate)}_to_${formatDate(toDate)}.xlsx`
        );
      } catch (err) {
        console.error("Excel generation error:", err);
        alert("Failed to generate Excel file. Check console for details.");
      }
    }
  };

  const data = {
    columns: [
      { label: "ID", field: "id", sort: "asc", width: 80 },
      {
        label: "Name",
        field: "name",
        sort: "asc",
        width: 150,
        render: (data, row) => (
          <span
            onClick={() => showEmployeeDetails(row.id)}
            style={{ cursor: "pointer", color: "blue" }}
          >
            {data}
          </span>
        ),
      },
      { label: "Present Days", field: "present", sort: "asc", width: 100 },
      { label: "Absent Days", field: "absent", sort: "asc", width: 100 },
      { label: "Leave Days", field: "leaveDays", sort: "asc", width: 100 },
      { label: "Week Off", field: "weekOff", sort: "asc", width: 100 },
      { label: "Remaining CLs", field: "remainingCL", sort: "asc", width: 120 },
      { label: "OD", field: "od", sort: "asc", width: 80 },
      { label: "Actions", field: "actions", sort: "disabled", width: 100 },
    ],
    rows: paginatedRows.map((emp) => ({
      ...emp,
      actions: (
        <Button
          color="primary"
          size="sm"
          onClick={() => {
            navigate("/month-wise-chart", {
              state: {
                empId: emp.id,
                empName: emp.name,
                fromDate,
                toDate,
                searchTerm,
                allEmployees,
                filteredRows,
              },
            });
          }}
        >
          View
        </Button>
      ),
    })),
  };

  return (
    <div className="month-wise-report-container">
      <h2 className="title">Month Wise Report</h2>
      <Card className="mb-4">
        <CardBody>
          <Row className="filters-row">
            <Col md={2}>
              <Label for="searchInput">Search ID/Name</Label>
              <input
                type="text"
                id="searchInput"
                className="form-control"
                placeholder="Enter ID or Name"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ width: "150px" }}
              />
            </Col>
            <Col md={4}>
              <Label for="fromDate">From Date</Label>
              <Flatpickr
                id="fromDate"
                className="form-control"
                value={fromDate}
                onChange={(date) => setFromDate(date[0])}
                options={{
                  altInput: true,
                  altFormat: "F j, Y",
                  dateFormat: "Y-m-d",
                }}
                placeholder="Select From Date"
              />
            </Col>
            <Col md={3}>
              <Label for="toDate">To Date</Label>
              <Flatpickr
                id="toDate"
                className="form-control"
                value={toDate}
                onChange={(date) => setToDate(date[0])}
                options={{
                  altInput: true,
                  altFormat: "F j, Y",
                  dateFormat: "Y-m-d",
                }}
                placeholder="Select To Date"
              />
            </Col>
          </Row>
        </CardBody>
      </Card>
      <Card>
        <CardBody>
          <Row className="mb-3">
            <Col md={6} className="d-flex align-items-center">
              <Label for="entries" className="me-2">Show entries</Label>
              <select
                id="entries"
                className="form-control"
                value={entries}
                onChange={(e) => {
                  setEntries(Number(e.target.value));
                  setCurrentPage(1);
                }}
                style={{ width: "80px" }}
              >
                <option value="5">5</option>
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
              </select>
            </Col>
            <Col md={6} className="d-flex justify-content-end align-items-center">
              <select
                id="downloadFormat"
                className="form-control me-2"
                value={downloadFormat}
                onChange={(e) => setDownloadFormat(e.target.value)}
                style={{ width: "120px" }}
              >
                <option value="pdf">PDF</option>
                <option value="excel">Excel</option>
              </select>
              <Button
                color="success"
                onClick={downloadData}
                disabled={filteredRows.length === 0}
              >
                Download
              </Button>
            </Col>
          </Row>
          {loading ? (
            <div className="text-center py-4">Loading...</div>
          ) : error ? (
            <div className="text-center py-4 text-danger">{error}</div>
          ) : filteredRows.length > 0 ? (
            <>
              <MDBDataTable
                responsive
                bordered
                hover
                data={data}
                paging={false}
                searching={false}
                sortable={true}
                noBottomColumns
                entries={entries}
                displayEntries={false}
              />
              <CustomPagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
              />
            </>
          ) : (
            <div className="text-center py-4">
              No data available. Try adjusting filters or check API connectivity.
            </div>
          )}
        </CardBody>
      </Card>

      <Modal isOpen={modal} toggle={toggleModal} centered size="lg">
        <ModalHeader toggle={toggleModal}>Employee Full Details</ModalHeader>
        <ModalBody>
          {selectedEmployee ? (
            <div className="employee-image-container">
              <div className="text-center">
                <img
                  src={`${baseURL}/emp/uploads/${selectedEmployee.empId}.JPG`}
                  alt={selectedEmployee.empName || "Employee"}
                  style={{
                    width: "85px",
                    height: "85px",
                    objectFit: "contain",
                    borderRadius: "40px",
                    border: "1px solid #ccc",
                    backgroundColor: "#fff",
                    padding: "5px",
                  }}
                  onError={(e) => {
                    const currentSrc = e.target.src;
                    if (currentSrc.endsWith(".JPG")) {
                      e.target.src = `${baseURL}/emp/uploads/${selectedEmployee.empId}.jpg`;
                    } else {
                      e.target.src = `${baseURL}/emp/uploads/0000.jpg`;
                    }
                  }}
                />
              </div>
              <Table className="table table-bordered">
                <tbody>
                  <tr>
                    <td className="label">
                      <strong>ID</strong>
                    </td>
                    <td className="detail">{selectedEmployee.empId || "N/A"}</td>
                    <td className="label">
                      <strong>Name</strong>
                    </td>
                    <td className="detail">{selectedEmployee.empName || "N/A"}</td>
                  </tr>
                  <tr>
                    <td className="label">
                      <strong>Designation</strong>
                    </td>
                    <td className="detail">{selectedEmployee.empDesignation || "N/A"}</td>
                    <td className="label">
                      <strong>Department</strong>
                    </td>
                    <td className="detail">{selectedEmployee.empDepartment || "N/A"}</td>
                  </tr>
                  <tr>
                    <td className="label">
                      <strong>Mobile No</strong>
                    </td>
                    <td className="detail">{selectedEmployee.empMobileNo || "N/A"}</td>
                    <td className="label">
                      <strong>Aadhar No</strong>
                    </td>
                    <td className="detail">{selectedEmployee.empAadharNo || "N/A"}</td>
                  </tr>
                  <tr>
                    <td className="label">
                      <strong>PAN No</strong>
                    </td>
                    <td className="detail">{selectedEmployee.empPanNo || "N/A"}</td>
                    <td className="label">
                      <strong>Date of Birth</strong>
                    </td>
                    <td className="detail">
                      {selectedEmployee.empDob !== "N/A"
                        ? new Date(selectedEmployee.empDob).toLocaleDateString()
                        : "N/A"}
                    </td>
                  </tr>
                  <tr>
                    <td className="label">
                      <strong>Address</strong>
                    </td>
                    <td colSpan={3} className="detail">
                      {selectedEmployee.empAddress || "N/A"}
                    </td>
                  </tr>
                  <tr>
                    <td className="label">
                      <strong>Bank Account No</strong>
                    </td>
                    <td className="detail">{selectedEmployee.empBankAccountNo || "N/A"}</td>
                    <td className="label">
                      <strong>EPF No</strong>
                    </td>
                    <td className="detail">{selectedEmployee.empEpfNo || "N/A"}</td>
                  </tr>
                  <tr>
                    <td className="label">
                      <strong>ESI No</strong>
                    </td>
                    <td className="detail">{selectedEmployee.empEsiNo || "N/A"}</td>
                    <td className="label">
                      <strong>Week Off</strong>
                    </td>
                    <td className="detail">{selectedEmployee.empWeekOff || "N/A"}</td>
                  </tr>
                </tbody>
              </Table>
            </div>
          ) : (
            <p className="text-center text-muted">Employee details not found</p>
          )}
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={toggleModal}>
            Close
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
};

export default MonthWiseReport;