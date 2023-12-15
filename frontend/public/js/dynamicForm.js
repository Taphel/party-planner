const foodsInput = document.querySelector("#foodsInput");
const foodPlusButton = document.querySelector("#foodPlusButton");
const foodMinusButton = document.querySelector("#foodMinusButton");

const drinksInput = document.querySelector("#drinksInput");
const drinkPlusButton = document.querySelector("#drinkPlusButton");
const drinkMinusButton = document.querySelector("#drinkMinusButton");

const otherInput = document.querySelector("#otherInput");
const otherPlusButton = document.querySelector("#otherPlusButton");
const otherMinusButton = document.querySelector("#otherMinusButton");

// Get array of created fields
let foodFields = document.querySelectorAll(".foodField");

let drinkFields = document.querySelectorAll(".drinkField");

let otherFields = document.querySelectorAll(".otherField");

function addField(type) {

    switch (type) {
        case "food":
            if (foodFields.length <= 4) {

                const newField = document.createElement("input");
                newField.setAttribute("class", "foodField form-control");
                newField.setAttribute("type", "text");
                newField.setAttribute("minLength", "3");
                newField.setAttribute("maxLength", "30");
                foodsInput.appendChild(newField);

        
                // Update foodFields nodeList
                foodFields = document.querySelectorAll(".foodField");

                // Set field name
                newField.setAttribute("name", `foods[${foodFields.length-1}]`);
            }
            break;

        case "drink":
            if (drinkFields.length <= 4) {

                const newField = document.createElement("input");
                newField.setAttribute("class", "drinkField form-control");
                newField.setAttribute("type", "text");
                newField.setAttribute("minLength", "3");
                newField.setAttribute("maxLength", "30");
                drinksInput.appendChild(newField);

        
                // Update drinkFields nodeList
                drinkFields = document.querySelectorAll(".drinkField");

                // Set field name
                newField.setAttribute("name", `drinks[${drinkFields.length-1}]`);
            }   

            break;
        case "other":
            if (otherFields.length <= 4) {

                const newField = document.createElement("input");
                newField.setAttribute("class", "otherField form-control");
                newField.setAttribute("type", "text");
                newField.setAttribute("minLength", "3");
                newField.setAttribute("maxLength", "30");
                otherInput.appendChild(newField);

        
                // Update otherFields nodeList
                otherFields = document.querySelectorAll(".otherField");

                // Set field name
                newField.setAttribute("name", `other[${otherFields.length-1}]`);
            } 
            break;
    }
}
    


function removeField(type) {

    switch(type) {
        case "food":
            if (foodFields.length > 1) {

                const deletedField = foodFields[foodFields.length-1];
                deletedField.remove();
        
                // Update foodFields nodeList
                foodFields = document.querySelectorAll(".foodField");
        
            }
            break;
        case "drink":
            if (drinkFields.length > 1) {

                const deletedField = drinkFields[drinkFields.length-1];
                deletedField.remove();
        
                // Update drinkFields nodeList
                drinkFields = document.querySelectorAll(".drinkField");
        
            }
            break;
        case "other":
            if (otherFields.length > 1) {

                const deletedField = otherFields[otherFields.length-1];
                deletedField.remove();
        
                // Update otherFields nodeList
                otherFields = document.querySelectorAll(".otherField");
        
            }
            break;
    }  
}

foodPlusButton.addEventListener("click", function() {addField("food")});
foodMinusButton.addEventListener("click", function() {removeField("food")});

drinkPlusButton.addEventListener("click", function() {addField("drink")});
drinkMinusButton.addEventListener("click", function() {removeField("drink")});

otherPlusButton.addEventListener("click", function() {addField("other")});
otherMinusButton.addEventListener("click", function() {removeField("other")});

// <input class="drinkField form-control" type="text" name="drinks[<%-drinks.indexOf(drink)%>]" minlength="3"
// maxlength="30" value="<%-drink%>">