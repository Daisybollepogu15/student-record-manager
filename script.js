/**
 * ============================================================================
 * Student Record Manager - script.js
 * ============================================================================
 * Pure JavaScript application for managing student records.
 * Features:
 *  - Form input and client-side array management
 *  - Email validation using Regular Expressions
 *  - File export (Blob & File APIs) as 'students.json'
 *  - File import (FileReader API) with comprehensive JSON validation
 *  - Robust try...catch exception handling with user-friendly alerts
 *  - Duplicate Student ID prevention
 *  - Live search filtering by student name
 *  - LocalStorage persistence
 *  - Dynamic UI stats and alternating table rows
 * ============================================================================
 */

// Strict mode for cleaner code and earlier error catching
'use strict';

/* ==========================================================================
   1. GLOBAL STATE & CONFIGURATION
   ========================================================================== */

/**
 * Array to hold student record objects in memory.
 * Structure of each item: { id: string, name: string, email: string, course: string, addedAt: string }
 */
let students = [];

/**
 * LocalStorage key for persistent client-side data
 */
const STORAGE_KEY = 'student_record_manager_db';

/* ==========================================================================
   2. DOM ELEMENT REFERENCES
   ========================================================================== */
const studentForm = document.getElementById('studentForm');
const studentIdInput = document.getElementById('studentId');
const studentNameInput = document.getElementById('studentName');
const studentEmailInput = document.getElementById('studentEmail');
const studentCourseInput = document.getElementById('studentCourse');

const btnClearForm = document.getElementById('btnClearForm');
const btnSaveData = document.getElementById('btnSaveData');
const btnReadData = document.getElementById('btnReadData');
const fileInput = document.getElementById('fileInput');

const studentTable = document.getElementById('studentTable');
const studentTableBody = document.getElementById('studentTableBody');
const emptyState = document.getElementById('emptyState');
const recordCountText = document.getElementById('recordCountText');

const searchBox = document.getElementById('searchBox');
const btnClearSearch = document.getElementById('btnClearSearch');

const statTotalStudents = document.getElementById('statTotalStudents');
const statTotalCourses = document.getElementById('statTotalCourses');
const toastContainer = document.getElementById('toastContainer');

/* ==========================================================================
   3. NOTIFICATION & TOAST UTILITY
   ========================================================================== */

/**
 * Displays a non-intrusive, user-friendly notification toast.
 * @param {string} message - The text message to display.
 * @param {'success'|'error'|'info'|'warning'} type - Category of message.
 * @param {number} duration - Milliseconds before auto-dismissal (default 4000ms).
 */
function showToast(message, type = 'info', duration = 4000) {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  // Icon mapping according to type
  let iconClass = 'fa-circle-info';
  let title = 'Information';

  if (type === 'success') {
    iconClass = 'fa-circle-check';
    title = 'Success';
  } else if (type === 'error') {
    iconClass = 'fa-circle-exclamation';
    title = 'Error';
  } else if (type === 'warning') {
    iconClass = 'fa-triangle-exclamation';
    title = 'Notice';
  }

  toast.innerHTML = `
    <i class="fa-solid ${iconClass} toast-icon"></i>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${escapeHtml(message)}</div>
    </div>
    <button type="button" class="toast-close" aria-label="Close notification">&times;</button>
  `;

  // Close button click listener
  const closeBtn = toast.querySelector('.toast-close');
  closeBtn.addEventListener('click', () => removeToast(toast));

  toastContainer.appendChild(toast);

  // Auto remove after timeout
  const timer = setTimeout(() => {
    removeToast(toast);
  }, duration);

  function removeToast(element) {
    clearTimeout(timer);
    element.classList.add('toast-hide');
    setTimeout(() => {
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
    }, 250);
  }
}

/**
 * Helper to escape HTML and prevent XSS injection in user inputs
 * @param {string} str 
 * @returns {string}
 */
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* ==========================================================================
   4. LOCAL STORAGE PERSISTENCE
   ========================================================================== */

/**
 * Saves current student records to browser's LocalStorage.
 * Wrapped in try-catch to handle quota or storage access errors.
 */
function saveToLocalStorage() {
  try {
    const serializedData = JSON.stringify(students);
    localStorage.setItem(STORAGE_KEY, serializedData);
  } catch (error) {
    console.error('LocalStorage write error:', error);
    showToast('Failed to sync data with browser local storage.', 'warning');
  }
}

/**
 * Loads student records from browser's LocalStorage on app startup.
 * Wrapped in try-catch to safely handle corrupt storage data.
 */
function loadFromLocalStorage() {
  try {
    const rawData = localStorage.getItem(STORAGE_KEY);
    if (rawData) {
      const parsed = JSON.parse(rawData);
      if (Array.isArray(parsed)) {
        students = parsed;
      } else {
        students = [];
      }
    } else {
      // Prepopulate with a couple sample records for a welcoming experience if first time
      students = [
        {
          id: 'STU-1001',
          name: 'Aarav Patel',
          email: 'aarav.patel@example.com',
          course: 'Computer Science',
          addedAt: new Date().toLocaleDateString()
        },
        {
          id: 'STU-1002',
          name: 'Priya Sharma',
          email: 'priya.sharma@example.com',
          course: 'Data Science & AI',
          addedAt: new Date().toLocaleDateString()
        }
      ];
      saveToLocalStorage();
    }
  } catch (error) {
    console.error('LocalStorage read error:', error);
    students = [];
    showToast('Could not load cached records from local storage.', 'warning');
  }
}

/* ==========================================================================
   5. UI RENDERING & DASHBOARD METRICS
   ========================================================================== */

/**
 * Refreshes the table rows according to a provided records array (or all students).
 * @param {Array} recordsToDisplay - Records to show (supports filtered search).
 */
function renderTable(recordsToDisplay = students) {
  studentTableBody.innerHTML = '';

  if (recordsToDisplay.length === 0) {
    studentTable.style.display = 'none';
    emptyState.style.display = 'block';
  } else {
    studentTable.style.display = 'table';
    emptyState.style.display = 'none';

    recordsToDisplay.forEach((student, index) => {
      const tr = document.createElement('tr');

      tr.innerHTML = `
        <td><strong>${index + 1}</strong></td>
        <td><span class="student-id-cell">${escapeHtml(student.id)}</span></td>
        <td class="student-name-cell">${escapeHtml(student.name)}</td>
        <td class="student-email-cell">
          <a href="mailto:${escapeHtml(student.email)}" title="Send email">
            ${escapeHtml(student.email)}
          </a>
        </td>
        <td>
          <span class="course-badge">${escapeHtml(student.course)}</span>
        </td>
        <td style="text-align: center;">
          <button 
            type="button" 
            class="btn-action-delete" 
            title="Delete ${escapeHtml(student.name)}"
            data-id="${escapeHtml(student.id)}"
            aria-label="Delete student record"
          >
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </td>
      `;

      // Attach event listener for the delete button
      const deleteBtn = tr.querySelector('.btn-action-delete');
      deleteBtn.addEventListener('click', () => {
        handleDeleteStudent(student.id, student.name);
      });

      studentTableBody.appendChild(tr);
    });
  }

  // Update records count label
  const total = students.length;
  const showing = recordsToDisplay.length;
  if (showing === total) {
    recordCountText.textContent = `Showing all ${total} record${total === 1 ? '' : 's'}`;
  } else {
    recordCountText.textContent = `Showing ${showing} of ${total} record${total === 1 ? '' : 's'}`;
  }

  updateDashboardStats();
}

/**
 * Recalculates and updates top header stats (Total Students, Unique Courses).
 */
function updateDashboardStats() {
  statTotalStudents.textContent = students.length;

  // Compute distinct course count
  const distinctCourses = new Set(
    students
      .map(s => (s.course || '').trim().toLowerCase())
      .filter(c => c.length > 0)
  );
  statTotalCourses.textContent = distinctCourses.size;
}

/* ==========================================================================
   6. VALIDATION & REGULAR EXPRESSION ENGINE
   ========================================================================== */

/**
 * Validates email format using Standard JavaScript Regular Expression.
 * Checks for: username + @ + domain name + dot + TLD (at least 2 letters).
 * @param {string} email 
 * @returns {boolean}
 */
function isValidEmail(email) {
  // RFC 5322 compliant regex for standard web email verification
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
}

/**
 * Performs rigorous validation on form fields and throws user-friendly exceptions.
 * @param {Object} data - { id, name, email, course }
 * @throws {Error} Descriptive error message if any check fails
 */
function validateStudentData(data) {
  // 1. Check for empty or whitespace-only fields
  if (!data.id || data.id.trim() === '') {
    const error = new Error('Student ID is required and cannot be empty.');
    error.field = studentIdInput;
    throw error;
  }

  if (!data.name || data.name.trim() === '') {
    const error = new Error('Student Name is required and cannot be empty.');
    error.field = studentNameInput;
    throw error;
  }

  if (!data.email || data.email.trim() === '') {
    const error = new Error('Email address is required and cannot be empty.');
    error.field = studentEmailInput;
    throw error;
  }

  if (!data.course || data.course.trim() === '') {
    const error = new Error('Course selection is required.');
    error.field = studentCourseInput;
    throw error;
  }

  // 2. Validate Student ID format (minimum 2 characters, alphanumeric with optional dashes/underscores)
  const idRegex = /^[A-Za-z0-9_-]{2,20}$/;
  if (!idRegex.test(data.id.trim())) {
    const error = new Error('Invalid Student ID format. Must be 2-20 alphanumeric characters (letters, numbers, hyphens, underscores).');
    error.field = studentIdInput;
    throw error;
  }

  // 3. Prevent Duplicate Student IDs (case-insensitive check)
  const isDuplicate = students.some(
    student => student.id.trim().toLowerCase() === data.id.trim().toLowerCase()
  );

  if (isDuplicate) {
    const error = new Error(`Student ID "${data.id.trim()}" is already registered. Duplicate IDs are not allowed.`);
    error.field = studentIdInput;
    throw error;
  }

  // 4. Validate Email Format using JavaScript Regular Expression
  if (!isValidEmail(data.email.trim())) {
    const error = new Error('Invalid email format! Please provide a valid address (e.g., username@domain.com).');
    error.field = studentEmailInput;
    throw error;
  }
}

/**
 * Removes error highlights from all inputs
 */
function clearInputErrors() {
  [studentIdInput, studentNameInput, studentEmailInput, studentCourseInput].forEach(input => {
    input.classList.remove('input-error');
  });
}

/* ==========================================================================
   7. ADD STUDENT FEATURE (WITH TRY...CATCH)
   ========================================================================== */

/**
 * Handles form submission for adding a new student.
 * Uses try...catch for exception handling as specified in requirements.
 */
function handleAddStudent(event) {
  event.preventDefault();
  clearInputErrors();

  try {
    // Collect field values
    const newStudent = {
      id: studentIdInput.value.trim(),
      name: studentNameInput.value.trim(),
      email: studentEmailInput.value.trim(),
      course: studentCourseInput.value.trim(),
      addedAt: new Date().toLocaleDateString()
    };

    // Validate inputs - throws detailed Error on failure
    validateStudentData(newStudent);

    // If validation passes, store into the array
    students.push(newStudent);

    // Update LocalStorage
    saveToLocalStorage();

    // Clear search box if an active search is filtering the table
    if (searchBox.value.trim() !== '') {
      searchBox.value = '';
      btnClearSearch.style.display = 'none';
    }

    // Refresh Table UI
    renderTable();

    // Reset form fields
    studentForm.reset();

    // Show friendly success toast notification
    showToast(`Student "${newStudent.name}" (${newStudent.id}) added successfully!`, 'success');

    // Keep focus on first field for rapid sequential entry
    studentIdInput.focus();

  } catch (error) {
    // Exception Handling: Catch validation errors and show friendly message
    console.warn('Student addition error caught:', error.message);

    // Highlight the offending input field if identified
    if (error.field) {
      error.field.classList.add('input-error');
      error.field.focus();
    }

    // Display user-friendly error toast
    showToast(error.message, 'error');
  }
}

/* ==========================================================================
   8. DELETE STUDENT FEATURE
   ========================================================================== */

/**
 * Deletes a student record by Student ID with user confirmation.
 * Wrapped in try-catch to ensure graceful handling.
 * @param {string} studentId 
 * @param {string} studentName 
 */
function handleDeleteStudent(studentId, studentName) {
  try {
    const confirmDelete = window.confirm(`Are you sure you want to remove ${studentName} (ID: ${studentId})?`);
    if (!confirmDelete) {
      return;
    }

    // Filter out the student
    const initialLength = students.length;
    students = students.filter(s => s.id !== studentId);

    if (students.length === initialLength) {
      throw new Error(`Student record with ID "${studentId}" could not be found.`);
    }

    // Persist changes
    saveToLocalStorage();

    // Re-render table with any active search filter retained
    handleLiveSearch();

    // Success feedback
    showToast(`Student "${studentName}" was successfully removed.`, 'info');

  } catch (error) {
    console.error('Delete student error:', error);
    showToast(error.message || 'An error occurred while deleting the record.', 'error');
  }
}

/* ==========================================================================
   9. SAVE DATA TO FILE (BLOB & FILE API)
   ========================================================================== */

/**
 * Converts student records into JSON format and prompts download as 'students.json'.
 * Uses JavaScript Blob and anchor download pattern.
 * Wrapped in try...catch for exception handling.
 */
function handleSaveData() {
  try {
    // Check if there are any records to save
    if (students.length === 0) {
      throw new Error('No student records available to save. Please add records first!');
    }

    // Convert records to formatted JSON string
    const jsonString = JSON.stringify(students, null, 2);

    // Create a Blob containing the JSON data
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });

    // Generate a temporary Object URL for the blob
    const downloadUrl = URL.createObjectURL(blob);

    // Create a temporary hidden link element to trigger the download
    const downloadAnchor = document.createElement('a');
    downloadAnchor.href = downloadUrl;
    downloadAnchor.download = 'students.json';
    document.body.appendChild(downloadAnchor);

    // Trigger click event
    downloadAnchor.click();

    // Cleanup: remove temporary element and revoke object URL
    document.body.removeChild(downloadAnchor);
    setTimeout(() => {
      URL.revokeObjectURL(downloadUrl);
    }, 1000);

    // Success message
    showToast(`Successfully exported ${students.length} record(s) to "students.json"!`, 'success');

  } catch (error) {
    console.error('Save data error:', error);
    showToast(error.message || 'Failed to save student data to file.', 'error');
  }
}

/* ==========================================================================
   10. READ DATA FROM FILE (FILEREADER API & JSON VALIDATION)
   ========================================================================== */

/**
 * Triggers hidden file input when the "Read Data" button is clicked.
 */
function triggerFileInput() {
  // Clear any previous selection so re-selecting the same file fires 'change'
  fileInput.value = '';
  fileInput.click();
}

/**
 * Reads and parses an uploaded JSON file using the FileReader API.
 * Contains thorough try...catch handling for:
 *  - File selection checks
 *  - File reading errors
 *  - JSON syntax parsing errors
 *  - Invalid or non-array schema validation
 * @param {Event} event 
 */
function handleFileUpload(event) {
  const file = event.target.files[0];

  // Return if user cancelled file chooser dialog
  if (!file) {
    return;
  }

  try {
    // Verify file type or extension
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.json') && file.type !== 'application/json') {
      throw new Error(`Invalid file type "${file.name}". Please upload a valid .json file!`);
    }

    // Initialize HTML5 FileReader
    const reader = new FileReader();

    // Event listener when reading begins
    reader.onload = function(e) {
      try {
        const fileContent = e.target.result;

        if (!fileContent || fileContent.trim() === '') {
          throw new Error('The selected file is empty.');
        }

        // Parse JSON content
        let parsedData;
        try {
          parsedData = JSON.parse(fileContent);
        } catch (jsonErr) {
          throw new Error('Invalid JSON format! The file content could not be parsed as valid JSON.');
        }

        // Verify root data structure is an Array
        if (!Array.isArray(parsedData)) {
          throw new Error('Invalid file structure! Expected a JSON array of student records (e.g. [ { ... } ]).');
        }

        // Validate each item in the array has required student fields
        const validRecords = [];
        let duplicateCount = 0;
        const seenIds = new Set(students.map(s => s.id.toLowerCase()));

        parsedData.forEach((item, idx) => {
          if (!item || typeof item !== 'object') {
            throw new Error(`Record at index ${idx + 1} is invalid.`);
          }

          const id = (item.id || '').toString().trim();
          const name = (item.name || '').toString().trim();
          const email = (item.email || '').toString().trim();
          const course = (item.course || '').toString().trim();

          // Check required fields
          if (!id || !name || !email || !course) {
            throw new Error(`Record #${idx + 1} has missing required fields (id, name, email, course).`);
          }

          // Check email format
          if (!isValidEmail(email)) {
            throw new Error(`Record #${idx + 1} ("${name}") has an invalid email format: ${email}`);
          }

          // Check duplicate ID against already existing records & incoming records
          const lowerId = id.toLowerCase();
          if (seenIds.has(lowerId)) {
            duplicateCount++;
          } else {
            seenIds.add(lowerId);
            validRecords.push({
              id: id,
              name: name,
              email: email,
              course: course,
              addedAt: item.addedAt || new Date().toLocaleDateString()
            });
          }
        });

        if (validRecords.length === 0 && duplicateCount > 0) {
          throw new Error(`All ${duplicateCount} records in this file already exist in your system.`);
        }

        // Merge newly loaded records with existing records
        students = [...students, ...validRecords];

        // Save merged data to localStorage
        saveToLocalStorage();

        // Update the table and stats
        renderTable();

        // Build informative success message
        let msg = `Successfully loaded ${validRecords.length} student record(s) from "${file.name}"!`;
        if (duplicateCount > 0) {
          msg += ` (${duplicateCount} duplicate ID(s) were skipped).`;
        }
        showToast(msg, 'success', 5000);

      } catch (innerError) {
        console.error('File parsing error:', innerError);
        showToast(innerError.message || 'Error occurred while processing file content.', 'error');
      }
    };

    // Error event listener for the FileReader
    reader.onerror = function() {
      showToast('An unexpected error occurred while reading the file from disk.', 'error');
    };

    // Read the file as plain text
    reader.readAsText(file);

  } catch (error) {
    console.error('File upload initialization error:', error);
    showToast(error.message || 'Failed to open the specified file.', 'error');
  }
}

/* ==========================================================================
   11. LIVE SEARCH FILTERING
   ========================================================================== */

/**
 * Filters the displayed students by name (case-insensitive substring match).
 */
function handleLiveSearch() {
  const query = searchBox.value.trim().toLowerCase();

  // Toggle clear button visibility
  if (query.length > 0) {
    btnClearSearch.style.display = 'flex';
  } else {
    btnClearSearch.style.display = 'none';
  }

  if (query === '') {
    renderTable(students);
    return;
  }

  // Filter students by name (and also match ID or course for extra utility)
  const filtered = students.filter(student => {
    const matchName = (student.name || '').toLowerCase().includes(query);
    const matchId = (student.id || '').toLowerCase().includes(query);
    const matchCourse = (student.course || '').toLowerCase().includes(query);
    return matchName || matchId || matchCourse;
  });

  renderTable(filtered);
}

/**
 * Resets search input and restores full table view.
 */
function handleClearSearch() {
  searchBox.value = '';
  btnClearSearch.style.display = 'none';
  renderTable(students);
  searchBox.focus();
}

/* ==========================================================================
   12. CLEAR FORM & HELPER ACTIONS
   ========================================================================== */

/**
 * Resets form fields and clears any validation error state styles.
 */
function handleClearForm() {
  studentForm.reset();
  clearInputErrors();
  showToast('Form fields cleared.', 'info', 2000);
  studentIdInput.focus();
}

/* ==========================================================================
   13. INITIALIZATION & EVENT LISTENERS
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Load any persisted student data from localStorage
  loadFromLocalStorage();

  // 2. Initial render of table and statistics
  renderTable();

  // 3. Form submission (Add Student)
  studentForm.addEventListener('submit', handleAddStudent);

  // 4. Clear Form Button
  btnClearForm.addEventListener('click', handleClearForm);

  // 5. Save Data Button (Blob / Download)
  btnSaveData.addEventListener('click', handleSaveData);

  // 6. Read Data Button & File Upload
  btnReadData.addEventListener('click', triggerFileInput);
  fileInput.addEventListener('change', handleFileUpload);

  // 7. Live Search Input & Clear Search
  searchBox.addEventListener('input', handleLiveSearch);
  btnClearSearch.addEventListener('click', handleClearSearch);

  // 8. Remove input error highlights as soon as user types
  [studentIdInput, studentNameInput, studentEmailInput, studentCourseInput].forEach(input => {
    input.addEventListener('input', () => {
      input.classList.remove('input-error');
    });
  });
});
