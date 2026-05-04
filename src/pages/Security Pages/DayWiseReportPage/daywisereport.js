import React, { useState, useMemo, useEffect, useRef } from "react";
import axios from "axios";
import { MDBDataTable } from "mdbreact";
import { Row, Col, Card, CardBody, Modal, ModalHeader, ModalBody, ModalFooter, Button, Label, Table, FormGroup, Input } from "reactstrap";
import Flatpickr from "react-flatpickr";
import "flatpickr/dist/themes/material_blue.css";
import "bootstrap/dist/css/bootstrap.min.css";
import "./daywisereport.css";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import CustomPagination from "../CustomPagination";
import { useNavigate } from "react-router-dom";

const DayWiseReport = () => {
  document.title = "Day Wise Report";

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedShift, setSelectedShift] = useState("All");
  const [modal, setModal] = useState(false);
  const [addModal, setAddModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [allEmployees, setAllEmployees] = useState([]);
  const [filteredRows, setFilteredRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [downloadFormat, setDownloadFormat] = useState("pdf");
  const [entries, setEntries] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [employeeDetailsCache, setEmployeeDetailsCache] = useState({});
  const [formData, setFormData] = useState({
    empId: "",
    date: new Date(),
    inTime: "00:00",
    outTime: "00:00",
    shift: "General",
    empWeekOff: "Sunday",
    mode: "Update",
  });
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [employeeBasicDetails, setEmployeeBasicDetails] = useState(null);
  const inTimeRef = useRef(null);
  const outTimeRef = useRef(null);
  const navigate = useNavigate();

  const baseURL = process.env.REACT_APP_APIKEY || "https://security-project-pe9c.onrender.com";

  const shiftOptions = ["General", "Shift-A", "Shift-B", "Shift-C"];
  const weekOffOptions = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const modeOptions = ["Update", "Add"];

  const formatDate = (date) => {
    if (!date) return null;
    if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const fetchEmployeeDetails = async () => {
    try {
      if (Object.keys(employeeDetailsCache).length > 0) return employeeDetailsCache;
      const response = await axios.get(`${baseURL}/emp/details`);
      const employees = response.data.reduce((acc, emp) => {
        acc[emp.empId] = {
          name: emp.empName || "N/A",
          phone: emp.empMobileNo ? String(emp.empMobileNo) : "N/A",
          designation: emp.empDesignation || "N/A",
          aadharNo: emp.empAadharNo ? String(emp.empAadharNo) : "N/A",
          panNo: emp.empPanNo || "N/A",
          dob: emp.empDob ? new Date(emp.empDob).toISOString().split("T")[0] : "N/A",
          doj: emp.empDoj || "N/A",
          image: emp.empImage || "N/A",
          department: emp.empDepartment || "N/A",
          address: emp.address || "N/A",
          bankAccountNo: emp.bankAccountNo ? String(emp.bankAccountNo) : "N/A",
          epfNo: emp.epfNo || "N/A",
          esiNo: emp.esiNo || "N/A",
          weekOff: emp.empWeekOff || "Sunday",
        };
        return acc;
      }, {});
      setEmployeeDetailsCache(employees);
      return employees;
    } catch (err) {
      console.error("Error fetching employee details:", err);
      setError(`Failed to fetch employee details: ${err.message}`);
      return {};
    }
  };

  const fetchAttendanceData = async (date, shift) => {
    if (!date) {
      setError("Please select a date.");
      setLoading(false);
      return [];
    }

    setLoading(true);
    setError(null);
    try {
      const employeeDetails = await fetchEmployeeDetails();
      const dateStr = formatDate(date);
      console.log("Fetching data for date:", dateStr, "shift:", shift, "raw date input:", date);

      const response = await axios.get(`${baseURL}/attendance/get/byDate/${dateStr}`);
      console.log("Full API response:", JSON.stringify(response.data, null, 2));

      let attendanceRecords = response.data.data || response.data || [];
      if (!Array.isArray(attendanceRecords)) {
        console.warn("Attendance records is not an array:", attendanceRecords);
        attendanceRecords = [];
      }

      if (shift !== "All") {
        attendanceRecords = attendanceRecords.filter((record) => record.empShift === shift);
      }

      console.log("Filtered attendanceRecords:", attendanceRecords);

      const employees = attendanceRecords.map((record) => {
        const empDetails = employeeDetails[record.empId] || {
          name: `Unknown Employee ${record.empId}`,
          phone: "N/A",
          designation: "N/A",
          aadharNo: "N/A",
          panNo: "N/A",
          dob: "N/A",
          doj: "N/A",
          image: "N/A",
        };

        return {
          id: record.empId,
          name: empDetails.name,
          phone: empDetails.phone,
          shift: record.empShift || "General",
          weekOff: record.empWeekOff || "Sunday",
          inTime: record.empInTime || "--",
          outTime: record.empOutTime || "--",
          action: record.empAction || "--",
          details: (
            <Button color="primary" size="sm" onClick={() => fetchEmployeeDetailsForModal(record.empId)}>
              View
            </Button>
          ),
        };
      });

      console.log("Mapped employees:", employees);
      setAllEmployees(employees);
      return employees;
    } catch (err) {
      const errorMessage = err.response
        ? `Failed to fetch data for date ${formatDate(date)}: ${err.response.status} - ${err.response.data.message || err.message}`
        : `Failed to fetch data for date ${formatDate(date)}: ${err.message}`;
      setError(errorMessage);
      console.error("Fetch Error:", err.response || err);
      setAllEmployees([]);
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log("useEffect triggered with selectedDate:", formatDate(selectedDate), "raw selectedDate:", selectedDate, "selectedShift:", selectedShift);
    if (selectedDate) {
      const fetchData = async () => {
        const employees = await fetchAttendanceData(selectedDate, selectedShift);
        console.log("Employees after fetch:", employees);
        applySearchFilter(employees);
      };
      fetchData();
    } else {
      setAllEmployees([]);
      setFilteredRows([]);
      setError(null);
    }
  }, [selectedDate, selectedShift]);

  const applySearchFilter = (employees) => {
    const query = searchQuery.toLowerCase().trim();
    if (query === "") {
      setFilteredRows(employees);
    } else {
      const filtered = employees.filter(
        (emp) => emp.name.toLowerCase().includes(query) || emp.id.toString().includes(query)
      );
      setFilteredRows(filtered);
    }
    setCurrentPage(1); // Reset to first page when filter changes
  };

  useEffect(() => {
    applySearchFilter(allEmployees);
  }, [searchQuery, allEmployees]);

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  const handleDateChange = (date) => {
    console.log("Date Selected:", date[0], "Formatted:", formatDate(date[0]));
    setSelectedDate(date[0]);
    setError(null);
  };

  const handleShiftChange = (e) => {
    console.log("Shift Selected:", e.target.value);
    setSelectedShift(e.target.value);
    setError(null);
  };

  const toggleModal = () => {
    setModal(!modal);
    setSelectedEmployee(null);
  };

  const toggleAddModal = () => {
    setAddModal(!addModal);
    setFormData({
      empId: "",
      date: new Date(),
      inTime: "00:00",
      outTime: "00:00",
      shift: "General",
      empWeekOff: "Sunday",
      mode: "Update",
    });
    setEmployeeBasicDetails(null);
    setFormError("");
    setFormSuccess("");
  };

  const fetchEmployeeDetailsForModal = async (empId) => {
    try {
      const employeeDetails = await fetchEmployeeDetails();
      const employee = employeeDetails[empId];
      if (employee) {
        setSelectedEmployee({
          empId,
          empName: employee.name,
          empDesignation: employee.designation,
          empMobileNo: employee.phone,
          empAadharNo: employee.aadharNo,
          empPanNo: employee.panNo,
          empDob: employee.dob,
          empDoj: employee.doj,
          empImage: employee.image,
          empDepartment: employee.department,
          empAddress: employee.address,
          empBankAccountNo: employee.bankAccountNo,
          empEpfNo: employee.epfNo,
          empEsiNo: employee.esiNo,
        });
      } else {
        setSelectedEmployee(null);
      }
      setModal(true);
    } catch (err) {
      console.error("Modal Fetch Error:", err);
      setSelectedEmployee(null);
      setModal(true);
    }
  };

  const fetchAttendanceForUpdate = async (empId, date) => {
    try {
      const dateStr = formatDate(date);
      console.log("Fetching attendance for update:", { empId, dateStr, rawDate: date });
      const response = await axios.get(`${baseURL}/attendance/get/byDate/${dateStr}`);
      console.log("Update API response:", JSON.stringify(response.data, null, 2));

      let attendanceRecords = response.data.data || response.data || [];
      if (!Array.isArray(attendanceRecords)) {
        console.warn("Attendance records is not an array:", attendanceRecords);
        attendanceRecords = [];
      }

      const records = attendanceRecords.filter((rec) => rec.empId === parseInt(formData.empId));
      if (records.length > 1) {
        setFormError("Multiple attendance records found for this employee on the selected date. Please resolve duplicates.");
        setFormData((prev) => ({
          ...prev,
          inTime: records[0].empInTime || "00:00",
          outTime: records[0].empOutTime || "00:00",
          shift: records[0].empShift || "General",
        }));
        return false;
      } else if (records.length === 1) {
        setFormData((prev) => ({
          ...prev,
          inTime: records[0].empInTime || "00:00",
          outTime: records[0].empOutTime || "00:00",
          shift: records[0].empShift || "General",
        }));
        setFormError("");
        return true;
      } else {
        setFormError("No attendance record found for this employee on the selected date. Please add a record first.");
        setFormData((prev) => ({
          ...prev,
          inTime: "00:00",
          outTime: "00:00",
          shift: "General",
        }));
        return false;
      }
    } catch (err) {
      console.error("Error fetching attendance for update:", err);
      setFormError(`Failed to fetch attendance data: ${err.message}`);
      setFormData((prev) => ({
        ...prev,
        inTime: "00:00",
        outTime: "00:00",
        shift: "General",
      }));
      return false;
    }
  };

  const handleFormChange = async (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (name === "empId" && value) {
      try {
        const employeeDetails = await fetchEmployeeDetails();
        const employee = employeeDetails[value];
        if (employee) {
          setEmployeeBasicDetails({
            empId: value,
            name: employee.name,
            designation: employee.designation,
            weekOff: employee.weekOff,
            image: employee.image,
          });
          setFormData((prev) => ({ ...prev, empWeekOff: employee.weekOff }));
          setFormError("");
        } else {
          setEmployeeBasicDetails(null);
          setFormError("Employee ID not found.");
        }
      } catch (err) {
        console.error("Error fetching employee details for form:", err);
        setEmployeeBasicDetails(null);
        setFormError("Failed to fetch employee details.");
      }
    }

    if (name === "mode") {
      if (value === "Update" && formData.empId && formData.date) {
        await fetchAttendanceForUpdate(formData.empId, formData.date);
      } else if (value === "Add") {
        setFormData((prev) => ({
          ...prev,
          inTime: "00:00",
          outTime: "00:00",
          shift: "General",
        }));
        setFormError("");
      }
    }
  };

  const handleTimeChange = (e, field) => {
    const { value, selectionStart } = e.target;
    let newValue = value.replace(/[^0-9]/g, "").slice(0, 4);
    let formattedValue = "";

    if (newValue.length >= 1 && parseInt(newValue[0]) > 2) {
      newValue = "2" + newValue.slice(1);
    }
    if (newValue.length >= 2) {
      const hours = parseInt(newValue.slice(0, 2));
      if (hours > 23) newValue = "23" + newValue.slice(2);
    }
    if (newValue.length >= 3 && parseInt(newValue[2]) > 5) {
      newValue = newValue.slice(0, 2) + "5" + newValue.slice(3);
    }

    if (newValue.length > 2) {
      formattedValue = newValue.slice(0, 2) + ":" + newValue.slice(2);
      if (newValue.length === 4 && selectionStart === 2) {
        e.target.selectionStart = 3;
        e.target.selectionEnd = 3;
      } else if (newValue.length === 4) {
        e.target.selectionStart = 5;
        e.target.selectionEnd = 5;
      }
    } else {
      formattedValue = newValue;
    }

    setFormData((prev) => ({ ...prev, [field]: formattedValue }));
  };

  const handleFormDateChange = async (date) => {
    setFormData((prev) => ({ ...prev, date: date[0] }));
    if (formData.mode === "Update" && formData.empId) {
      await fetchAttendanceForUpdate(formData.empId, date[0]);
    }
  };

  const handleFormSubmit = async () => {
    setFormError("");
    setFormSuccess("");

    if (!formData.empId || isNaN(formData.empId)) {
      setFormError("Employee ID must be a valid number.");
      return;
    }
    if (!formData.date) {
      setFormError("Date is required.");
      return;
    }
    if (!formData.inTime || !/^\d{2}:\d{2}$/.test(formData.inTime)) {
      setFormError("Valid In Time (HH:MM) is required.");
      return;
    }
    if (!formData.outTime || !/^\d{2}:\d{2}$/.test(formData.outTime)) {
      setFormError("Valid Out Time (HH:MM) is required.");
      return;
    }
    if (!formData.shift) {
      setFormError("Shift is required.");
      return;
    }
    if (formData.mode === "Add" && !formData.empWeekOff) {
      setFormError("Week Off is required for Add mode.");
      return;
    }

    const convertTo24Hour = (time) => {
      if (time.includes("AM") || time.includes("PM")) {
        const [timePart, period] = time.split(" ");
        let [hours, minutes] = timePart.split(":").map(Number);
        if (period === "PM" && hours !== 12) hours += 12;
        if (period === "AM" && hours === 12) hours = 0;
        return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
      }
      return time;
    };

    if (formData.mode === "Update") {
      const canUpdate = await fetchAttendanceForUpdate(formData.empId, formData.date);
      if (!canUpdate) {
        return;
      }
    }

    const payload = {
      empId: parseInt(formData.empId),
      empDate: formatDate(formData.date),
      empInTime: convertTo24Hour(formData.inTime),
      empOutTime: convertTo24Hour(formData.outTime),
      empShift: formData.shift,
      empWeekOff: formData.empWeekOff,
      empAction: "Present",
    };

    try {
      if (formData.mode === "Add") {
        console.log("Adding attendance with payload:", payload);
        const response = await axios.post(`${baseURL}/attendance/add`, payload);
        console.log("Attendance added:", response.data);
        setFormSuccess("Attendance added successfully!");
      } else {
        const updatePayload = {
          empDate: formatDate(formData.date),
          empInTime: convertTo24Hour(formData.inTime),
          empOutTime: convertTo24Hour(formData.outTime),
          empShift: formData.shift,
        };
        console.log("Updating attendance with payload:", updatePayload);
        const response = await axios.put(`${baseURL}/attendance/update/${formData.empId}`, updatePayload);
        console.log("Attendance updated:", response.data);
        setFormSuccess("Attendance updated successfully!");
      }

      if (formatDate(formData.date) === formatDate(selectedDate)) {
        const employees = await fetchAttendanceData(selectedDate, selectedShift);
        applySearchFilter(employees);
      }

      setTimeout(() => {
        toggleAddModal();
      }, 1000);
    } catch (err) {
      console.error(`Error ${formData.mode === "Add" ? "adding" : "updating"} attendance:`, err);
      console.error("Error response:", err.response);
      const errorMessage = err.response?.data?.message || err.response?.statusText || err.message || "Unknown error occurred";
      setFormError(`Failed to ${formData.mode === "Add" ? "add" : "update"} attendance: ${errorMessage} (Status: ${err.response?.status || "N/A"})`);
    }
  };

  const downloadData = () => {
    const dataToDownload = filteredRows.length > 0 ? filteredRows : allEmployees;
    const headers = ["ID", "Name", "Phone", "Shift", "Week Off", "In Time", "Out Time", "Action"];
    const csvData = [
      headers,
      ...dataToDownload.map((row) => [
        row.id,
        row.name,
        row.phone,
        row.shift,
        row.weekOff,
        row.inTime,
        row.outTime,
        row.action,
      ]),
    ];

    if (downloadFormat === "pdf") {
      try {
        const doc = new jsPDF();
        autoTable(doc, {
          head: [csvData[0]],
          body: csvData.slice(1),
          startY: 20,
        });
        doc.save(`day_wise_report_${formatDate(selectedDate) || "unknown"}.pdf`);
      } catch (err) {
        console.error("PDF generation error:", err);
        alert("Failed to generate PDF. Check console for details.");
      }
    } else if (downloadFormat === "excel") {
      const csv = csvData.map((row) => row.join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(blob);
      link.download = `day_wise_report_${formatDate(selectedDate) || "unknown"}.csv`;
      link.click();
    }
  };

  const totalItems = filteredRows.length;
  const totalPages = Math.ceil(totalItems / entries);
  const startIndex = (currentPage - 1) * entries;
  const endIndex = Math.min(startIndex + entries, totalItems);
  const paginatedRows = filteredRows.slice(startIndex, endIndex);

  const data = useMemo(() => ({
    columns: [
      { label: "ID", field: "id", sort: "asc", width: 100 },
      { label: "Name", field: "name", sort: "asc", width: 200 },
      { label: "Phone", field: "phone", sort: "asc", width: 150 },
      { label: "Shift", field: "shift", sort: "asc", width: 120 },
      { label: "Week Off", field: "weekOff", sort: "asc", width: 120 },
      { label: "In Time", field: "inTime", sort: "asc", width: 120 },
      { label: "Out Time", field: "outTime", sort: "asc", width: 120 },
      { label: "Action", field: "action", sort: "asc", width: 120 },
      { label: "Details", field: "details", sort: "disabled", width: 120 },
    ],
    rows: paginatedRows || [],
  }), [paginatedRows]);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  return (
    <div className="container mt-4">
      <h2 className="title mb-3">Day Wise Report</h2>

      <Row className="mb-3">
        <Col md={3}>
          <Label for="searchInput">Search by ID or Name</Label>
          <input
            type="text"
            id="searchInput"
            placeholder="Enter ID or Name"
            value={searchQuery}
            onChange={handleSearchChange}
            className="form-control"
          />
        </Col>
        <Col md={3}>
          <Label>Select Date</Label>
          <Flatpickr
            className="form-control"
            value={selectedDate}
            onChange={handleDateChange}
            options={{
              altInput: true,
              altFormat: "F j, Y",
              dateFormat: "Y-m-d",
              allowInput: true,
            }}
            placeholder="Select a date"
          />
        </Col>
        <Col md={3}>
          <Label for="shiftSelect">Select Shift</Label>
          <select
            id="shiftSelect"
            className="form-control"
            value={selectedShift}
            onChange={handleShiftChange}
          >
            {shiftOptions.concat("All").map((shift) => (
              <option key={shift} value={shift}>
                {shift}
              </option>
            ))}
          </select>
        </Col>
        <Col md={2} className="d-flex align-items-end">
          <Button color="primary" onClick={toggleAddModal}>
            Add/Update
          </Button>
        </Col>
      </Row>

      <Row>
        <Col>
          <Card>
            <CardBody className="position-relative">
              <div className="d-flex justify-content-between mb-2 align-items-center">
                <div className="d-flex align-items-center ms-2">
                  <Label for="entries" className="me-2">Show entries</Label>
                  <select
                    id="entries"
                    className="form-control"
                    value={entries}
                    onChange={(e) => {
                      setEntries(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    style={{ width: "70px" }}
                  >
                    <option value="5">5</option>
                    <option value="10">10</option>
                    <option value="20">20</option>
                    <option value="50">50</option>
                  </select>
                </div>
                <div className="d-flex align-items-center">
                  <select
                    id="downloadFormat"
                    className="form-control me-2"
                    value={downloadFormat}
                    onChange={(e) => setDownloadFormat(e.target.value)}
                    style={{ width: "100px" }}
                  >
                    <option value="pdf">PDF</option>
                    <option value="excel">Excel</option>
                  </select>
                  <Button color="success" onClick={downloadData} disabled={!selectedDate || !allEmployees.length}>
                    Download
                  </Button>
                </div>
              </div>
              {loading ? (
                <div className="text-center py-4">Loading...</div>
              ) : error ? (
                <div className="text-center py-4 text-danger">{error}</div>
              ) : !selectedDate ? (
                <div className="text-center py-4 text-muted">Please select a date to view records.</div>
              ) : allEmployees.length > 0 ? (
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
                    displayEntries={false}
                    className="full-width-table"
                  />
                  <CustomPagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={handlePageChange}
                  />
                </>
              ) : (
                <div className="text-center py-4 text-muted">
                  No records found for {formatDate(selectedDate)}.
                </div>
              )}
            </CardBody>
          </Card>
        </Col>
      </Row>

      <Modal isOpen={modal} toggle={toggleModal} centered size="lg">
        <ModalHeader toggle={toggleModal}>Employee Full Details</ModalHeader>
        <ModalBody>
          {selectedEmployee ? (
            <>
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
              </div>
              <Table className="table table-bordered">
                <tbody>
                  <tr>
                    <td className="label"><strong>ID</strong></td>
                    <td className="detail">{selectedEmployee.empId || "N/A"}</td>
                    <td className="label"><strong>Name</strong></td>
                    <td className="detail">{selectedEmployee.empName || "N/A"}</td>
                  </tr>
                  <tr>
                    <td className="label"><strong>Designation</strong></td>
                    <td className="detail">{selectedEmployee.empDesignation || "N/A"}</td>
                    <td className="label"><strong>Department</strong></td>
                    <td className="detail">{selectedEmployee.empDepartment || "N/A"}</td>
                  </tr>
                  <tr>
                    <td className="label"><strong>Mobile No</strong></td>
                    <td className="detail">{selectedEmployee.empMobileNo || "N/A"}</td>
                    <td className="label"><strong>Aadhar No</strong></td>
                    <td className="detail">{selectedEmployee.empAadharNo || "N/A"}</td>
                  </tr>
                  <tr>
                    <td className="label"><strong>PAN No</strong></td>
                    <td className="detail">{selectedEmployee.empPanNo || "N/A"}</td>
                    <td className="label"><strong>Date of Joining</strong></td>
                    <td className="detail">
                      {selectedEmployee.empDoj !== "N/A"
                        ? new Date(selectedEmployee.empDoj).toLocaleDateString()
                        : "N/A"}
                    </td>
                  </tr>
                  <tr>
                    <td className="label"><strong>Date of Birth</strong></td>
                    <td className="detail">
                      {selectedEmployee.empDob !== "N/A"
                        ? new Date(selectedEmployee.empDob).toLocaleDateString()
                        : "N/A"}
                    </td>
                    <td className="label"><strong>ESI No</strong></td>
                    <td className="detail">{selectedEmployee.empEsiNo || "N/A"}</td>
                  </tr>
                  <tr>
                    <td className="label"><strong>Bank Account No</strong></td>
                    <td className="detail">{selectedEmployee.empBankAccountNo || "N/A"}</td>
                    <td className="label"><strong>EPF No</strong></td>
                    <td className="detail">{selectedEmployee.empEpfNo || "N/A"}</td>
                  </tr>
                  <tr>
                    <td colSpan={4} className="address">
                      <strong>Address: </strong>
                      {selectedEmployee.empAddress || "N/A"}
                    </td>
                  </tr>
                </tbody>
              </Table>
            </>
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

      <Modal isOpen={addModal} toggle={toggleAddModal} centered>
        <ModalHeader toggle={toggleAddModal}>Add/Update Attendance</ModalHeader>
        <ModalBody>
          <FormGroup>
            <Label for="mode">Mode</Label>
            <Input
              type="select"
              name="mode"
              id="mode"
              value={formData.mode}
              onChange={handleFormChange}
            >
              {modeOptions.map((mode) => (
                <option key={mode} value={mode}>
                  {mode}
                </option>
              ))}
            </Input>
          </FormGroup>
          <FormGroup>
            <Label for="empId">Employee ID</Label>
            <Input
              type="text"
              name="empId"
              id="empId"
              value={formData.empId}
              onChange={handleFormChange}
              placeholder="Enter Employee ID"
            />
          </FormGroup>
          {employeeBasicDetails && (
            <div className="employee-details-container mb-3">
              <div className="employee-details-text">
                <p><strong>Name:</strong> {employeeBasicDetails.name}</p>
                <p><strong>Designation:</strong> {employeeBasicDetails.designation}</p>
                <p><strong>Week Off:</strong> {employeeBasicDetails.weekOff}</p>
              </div>
              <div className="employee-image-container">
                <div className="text-center">
                  <img
                    src={`${baseURL}/emp/uploads/${employeeBasicDetails.empId}.JPG`}
                    alt={employeeBasicDetails.name || "Employee"}
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
                        e.target.src = `${baseURL}/emp/uploads/${employeeBasicDetails.empId}.jpg`;
                      } else {
                        e.target.src = `${baseURL}/emp/uploads/0000.jpg`;
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          )}
          <FormGroup>
            <Label for="date">Date</Label>
            <Flatpickr
              className="form-control"
              value={formData.date}
              onChange={handleFormDateChange}
              options={{
                altInput: true,
                altFormat: "F j, Y",
                dateFormat: "Y-m-d",
              }}
              placeholder="Select a date"
            />
          </FormGroup>
          <FormGroup>
            <Label for="inTime">In Time (HH:MM)</Label>
            <Input
              type="text"
              name="inTime"
              id="inTime"
              value={formData.inTime}
              onChange={(e) => handleTimeChange(e, "inTime")}
              ref={inTimeRef}
              maxLength="5"
              placeholder="e.g., 00:00"
            />
          </FormGroup>
          <FormGroup>
            <Label for="outTime">Out Time (HH:MM)</Label>
            <Input
              type="text"
              name="outTime"
              id="outTime"
              value={formData.outTime}
              onChange={(e) => handleTimeChange(e, "outTime")}
              ref={outTimeRef}
              maxLength="5"
              placeholder="e.g., 00:00"
            />
          </FormGroup>
          <FormGroup>
            <Label for="shift">Shift</Label>
            <Input
              type="select"
              name="shift"
              id="shift"
              value={formData.shift}
              onChange={handleFormChange}
            >
              {shiftOptions.map((shift) => (
                <option key={shift} value={shift}>
                  {shift}
                </option>
              ))}
            </Input>
          </FormGroup>
          <FormGroup className={formData.mode === "Update" ? "d-none" : ""}>
            <Label for="empWeekOff">Week Off</Label>
            <Input
              type="select"
              name="empWeekOff"
              id="empWeekOff"
              value={formData.empWeekOff}
              onChange={handleFormChange}
              disabled
            >
              {weekOffOptions.map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </Input>
          </FormGroup>
          <div> {/* Wrap adjacent elements in a div */}
            {formError && <p className="text-danger">{formError}</p>}
            {formSuccess && <p className="text-success">{formSuccess}</p>}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button color="primary" onClick={handleFormSubmit}>
            Submit
          </Button>
          <Button color="secondary" onClick={toggleAddModal}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
};

export default DayWiseReport;