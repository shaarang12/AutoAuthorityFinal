
const form = document.getElementById('my-form');

async function handleSubmit(event) {
  event.preventDefault();

  const { username, password } = event.target.elements;

  // Hash the password using bcrypt
  const hashedPassword = await bcrypt.hash(password.value, 10);


  if (response.ok) {
    console.log('User created successfully!');
  } else {
    console.error('Failed to create user:', response.statusText);
  }
}

form.addEventListener('submit', handleSubmit);