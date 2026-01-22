if(document.getElementById('radioinfo'))document.getElementById('radioinfo').addEventListener('valueChanged', () => {
  const serverpingElement = document.getElementById('radioinfo');
  let jsri = JSON.parse(serverpingElement.value);
  updatefrequence(jsri['VFOA frequency']);
});
function updateRadioInfo() {
  const frequencyDisplay = document.getElementById("frequencyDisplay");
  const digitElements = frequencyDisplay.querySelectorAll(".digit");

  // Combine digits into a single number
  let frequencyValue = "";
  digitElements.forEach((digitElement) => {
    frequencyValue += digitElement.textContent;
  });

  // Convert to a number for proper formatting (remove leading zeros)
  frequencyValue = parseInt(frequencyValue, 10);

  // Update the hidden input field with the new frequency
  const radioinfoElement = document.getElementById("radioinfo");
  let jsri = JSON.parse(radioinfoElement.value);
  jsri['VFOA frequency'] = frequencyValue;
  radioinfoElement.value = JSON.stringify(jsri);

  // Trigger the valueChanged event
  const event = new Event("valueChanged");
  radioinfoElement.dispatchEvent(event);

  console.log("Updated radioinfo:", radioinfoElement.value);
}
function updatefrequence(frequencyValue) {
  // Convert the frequencyValue to a string to access individual digits
  const frequencyString = frequencyValue.toString().padStart(9, "0");

  // Ensure the frequency has consistent formatting (e.g., length and separators)
  // Example: Pad the frequency to match expected format (e.g., 145450000 -> "145.450.000")
  const formattedFrequency = frequencyString.slice(0, 3) + "." + frequencyString.slice(3, 6) + "." + frequencyString.slice(6);

  // Map formattedFrequency digits to the corresponding digit elements
  const frequencyDisplay = document.getElementById("frequencyDisplay");
  const digitElements = frequencyDisplay.querySelectorAll(".digit, .separator");

  let currentIndex = 0;

  formattedFrequency.split("").forEach((char, index) => {
    const element = digitElements[currentIndex];
    if (element) {
      element.textContent = char; // Update digit or separator
      currentIndex++;
    }
  });
}
// Function to handle updating a specific digit
    function updateDigit(digitElement, increment) {
      let idtarget = digitElement.id;
      let parreN = idtarget.substring(1);
      let currentValue = parseInt(digitElement.textContent, 10);
      let newValue = increment ? currentValue + 1 : currentValue - 1;

      // Keep value between 0 and 9 for individual digits
      if (newValue > 9) {newValue = 0;updateDigit(document.getElementById("d"+(parreN-1)),true);}
      if (newValue < 0) {newValue = 9;updateDigit(document.getElementById("d"+(parreN-1)),false);}

      digitElement.textContent = newValue;
      updateRadioInfo();
    }

    const frequencyDisplay = document.getElementById("frequencyDisplay");

    // Event listener for PC clicks
    frequencyDisplay.addEventListener("click", (event) => {
      if (event.target.classList.contains("digit")) {
        const rect = event.target.getBoundingClientRect();
        const clickY = event.clientY;
        // Upper part clicked - increment digit
        if (clickY < rect.top + rect.height / 2) {
          updateDigit(event.target, true);
        } else {
          // Lower part clicked - decrement digit
          updateDigit(event.target, false);
        }
      }
    });

    // Variables for mobile swipe gestures
    let touchStartY = null;
		let time = 0;
    // Event listeners for mobile swipe gestures
    frequencyDisplay.addEventListener("touchstart", (event) => {
      if (event.target.classList.contains("digit")) {
        time = Date.now();
        touchStartY = event.touches[0].clientY;
      }
      event.preventDefault();
      const clickEvent = new MouseEvent('click', {
        bubbles: true, // Allow event to propagate
        cancelable: true, // Allow the event to be canceled
        clientY: touchStartY,
        view: window, // Set the view to the current window
      });
      event.target.dispatchEvent(clickEvent);
    });
		function delay(ms){return new Promise(resolve => setTimeout(resolve, ms));}
    frequencyDisplay.addEventListener("touchend", async (event) => {
      if (event.target.classList.contains("digit")) {
        const touchEndY = event.changedTouches[0].clientY;
        let repeat = 1;
        if((Date.now()-time)<300)repeat = 300-(Date.now()-time);
        time = Date.now();
        if (touchStartY && touchEndY) {
          if (touchEndY < touchStartY-10){
            // Swipe up - increment digit
            for(let i = 0;i<repeat;i++){updateDigit(event.target, true);await delay(1);}
          }else if (touchEndY < touchStartY) {
            updateDigit(event.target, true);
          } else if (touchEndY > touchStartY+10){
            // Swipe down - decrement digit
            for(let i = 0;i<repeat;i++){updateDigit(event.target, false);await delay(1);}
          } else if (touchEndY > touchStartY){
            // Swipe down - decrement digit
            updateDigit(event.target, false);
          }
        }
        touchStartY = null; // Reset touchStartY
      }
    });