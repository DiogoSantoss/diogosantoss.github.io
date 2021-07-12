const header = document.querySelector("h1");

header.addEventListener("click",updateName);

function updateName(){
    let name = prompt("Enter a new name: ");
    if(name.trim() === ""){
        name="type something"
    }
    header.textContent = name;
}

document.addEventListener("DOMContentLoaded",function(){
    function createParagraph(){
        let para = document.createElement("p");
        para.textContent = "You clicked the button!";
        document.body.appendChild(para);
    }

    const buttons = document.querySelectorAll("button");

    for(let i = 0; i<buttons.length; i++){
        buttons[i].addEventListener("click",createParagraph);
    }
})