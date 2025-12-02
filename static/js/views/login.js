/**
 * Login Page JavaScript
 * Handles form submission, password toggle, loading states, and authentication
 */

document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const userIdInput = document.getElementById('userId');
    const passwordInput = document.getElementById('password');
    const passwordToggle = document.getElementById('passwordToggle');
    const eyeIcon = document.getElementById('eyeIcon');
    const eyeOffIcon = document.getElementById('eyeOffIcon');
    const signInButton = document.getElementById('signInButton');
    const buttonSpinner = document.getElementById('buttonSpinner');
    const errorMessage = document.getElementById('errorMessage');

    let isPasswordVisible = false;

    // Password visibility toggle
    if (passwordToggle) {
        passwordToggle.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            isPasswordVisible = !isPasswordVisible;
            
            if (isPasswordVisible) {
                passwordInput.type = 'text';
                eyeIcon.style.display = 'none';
                eyeOffIcon.style.display = 'block';
            } else {
                passwordInput.type = 'password';
                eyeIcon.style.display = 'block';
                eyeOffIcon.style.display = 'none';
            }
        });
    }

    // Enter key support in password field
    passwordInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (userIdInput.value.trim() && passwordInput.value.trim()) {
                handleLogin();
            }
        }
    });

    // Form submission handler
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            handleLogin();
        });
    }

    /**
     * Handle login submission
     */
    function handleLogin() {
        const userId = userIdInput.value.trim();
        const password = passwordInput.value.trim();

        // Hide error message
        errorMessage.style.display = 'none';

        // Validate that both fields are filled
        if (!userId || !password) {
            showError('Please enter both User ID and Password');
            return;
        }

        // Show loading state
        setLoadingState(true);

        // Prepare form data
        const formData = new FormData();
        formData.append('userId', userId);
        formData.append('password', password);

        // Send login request
        fetch('/login', {
            method: 'POST',
            body: formData,
            credentials: 'same-origin'
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(data => {
                    throw new Error(data.error || 'Login failed');
                });
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                // Redirect to review page
                window.location.href = '/review';
            } else {
                throw new Error(data.error || 'Invalid credentials');
            }
        })
        .catch(error => {
            setLoadingState(false);
            showError(error.message || 'Invalid credentials');
            // Clear password field on error
            passwordInput.value = '';
            // Reset password visibility
            if (isPasswordVisible) {
                passwordToggle.click();
            }
        });
    }

    /**
     * Set loading state on the sign in button
     */
    function setLoadingState(isLoading) {
        if (isLoading) {
            signInButton.classList.add('loading');
            signInButton.disabled = true;
            buttonSpinner.style.display = 'inline-flex';
        } else {
            signInButton.classList.remove('loading');
            signInButton.disabled = false;
            buttonSpinner.style.display = 'none';
        }
    }

    /**
     * Show error message
     */
    function showError(message) {
        errorMessage.textContent = message || 'Invalid credentials';
        errorMessage.style.display = 'block';
        
        // Scroll error into view if needed
        errorMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
});

