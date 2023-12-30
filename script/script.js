document.addEventListener("DOMContentLoaded", function () {
    const images = document.querySelectorAll("#imageContainer img");
    const imageLink = document.getElementById("imageLink");
    let currentIndex = 0;
  
    function showImage(index) {
      images.forEach((image, i) => {
        image.classList.toggle("active", i === index);
      });
    }
  
    function rotateImages() {
      currentIndex = (currentIndex + 1) % images.length;
      showImage(currentIndex);
    }
  
    function navigateToCollection() {
      window.location.href = "collection.html";
    }
  
    setInterval(rotateImages, 1000); // Rotate every 1 second
  
    imageLink.addEventListener("click", navigateToCollection);
  });