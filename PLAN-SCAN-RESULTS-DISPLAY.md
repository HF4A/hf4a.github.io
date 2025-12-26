Okay we're planning a fairly major refactor of the scan results page 

Due to persistent issues in merging the results of the API match with what's displayed by the OpenCV detected boxes, we're going to radically simplify the scan results page.

When the photo is first snapped, it will display the photo and display the identified OpenCV bounding boxes as it currently does with the animation to identify to indicate that things are being updated 

Once the results come back from the API though, the image will be replaced with a grid which is dynamically generated from the images of the identified cards.  The results from the API should be interpreted or evaluated to determine what the N x M grid looks like, and that layout should reflect the grid layout on the screen. The grid layout on the screen will not try to be an accurate representation of what was scanned in the image. It will just be a simple N x M scrollable grid. In default zoom, it should easily be able to hold a 3x3 grid showing cards for all three rows and columns. Interactions with the cards happen just like it does currently. In terms of single-click to flip, double-click to open details page. 

In the rare event that a card is not able to be identified, a scaled version of that portion of the original image will be displayed in its place with a dialog, "Unidentified click to ID." Which will open the existing corrections interface. 