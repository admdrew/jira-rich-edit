// ==UserScript==
// @name        Jira Rich Edit
// @namespace   https://jira.trustwave.com
// @description (by Andy George) Allows for WYSIWYG editing of some Jira fields
// @include     http://jira.trustwave.com/*
// @include     https://jira.trustwave.com/*
// @version     2012-11-14
// @grant       none
// ==/UserScript==

/* workflow/notes

- wiki table parsing
	- textarea:customfield_10043 object
	- str rawMarkup = textarea:customfield_10043.innerHTML
	- first, split on || or | + \n (this makes array of rows)
		Array allRows = rawMarkup.split(/\|\n/)
	- foreach array of rows, split on || or | (this makes array of cells)

- edit button
	- add to end of <div id="customfield_10043-wiki-edit"> ?
*/

// get textarea:customfield_10043
/*
var taTestSteps = document.evaluate("//textarea[@id='customfield_10043']",
	document,
	null,
	XPathResult.FIRST_ORDERED_NODE_TYPE,
	null);

//*/

/****************
element ID strings
****************/
var EL_JIRA_EDIT_DIV = "customfield_10043-wiki-edit";	// (existing) div we place our new magical controls into
var EL_JIRA_EDIT_TEXTAREA = "customfield_10043";		// (existing) main wiki edit textarea
var EL_TW_EDIT_TABLE = "Jira_Rich_Edit-tableEdit";		// (new) editing table
var EL_TW_EDIT_BUTTON = "Jira_Rich_Edit-edit_button";	// (new) edit button, moves to table edit state
var EL_TW_SAVE_BUTTON = "Jira_Rich_Edit-save_button";	// (new) save button, copies table info to jira, moves to jira edit state
var EL_TW_CANCEL_BUTTON = "Jira_Rich_Edit-cancel_button";	// (new) cancel button, moves to jira edit state

// make some style:
function addGlobalStyle(css) {
    var head, style;
    head = document.getElementsByTagName('head')[0];
    if (!head) { return; }
    style = document.createElement('style');
    style.type = 'text/css';
    style.innerHTML = css;
    head.appendChild(style);
}

/*addGlobalStyle(
'.hidethis {' + 
'display:none;' + 
'left: 0; ' +
'right: 0; ' +
'}');*/

// automatically increases height of textarea while you type
// originally from http://stackoverflow.com/questions/2208682/specify-no-of-rows-of-textarea-depending-on-content-html-javascript
function stretchy(element) {
	var value = element.value;
	function update() {	
		var h = element.scrollHeight;
		if (h > element.offsetHeight || h < element.offsetHeight - 48)
			element.style.height = (h + 24) + 'px';
	}
	element.onkeyup = update;
	update();
	setInterval(update, 100);
}

/****************
Identify/create objected needed
****************/
var divEditButtons = document.getElementById(EL_JIRA_EDIT_DIV);
var taTestSteps = document.getElementById(EL_JIRA_EDIT_TEXTAREA); // works
stretchy(taTestSteps);	// maybe turn this off? make configurable?

//var rawMarkup = taTestSteps.value;	// moved this

//var newlineCount = (rawMarkup.match(/\n/g).length);


/****************
convertRawjiraToTable(string) -> table obj

input: string containing a Confluence-formatted table
output: table DOM object
****************/
function convertRawjiraToTable(strTestStepsRaw) {
	//var allRows = [];
	//allRows.push("the first row pushed");
	// EOJR = end of jira row
	// EOJC = end of jira cell
	// EOJCH = end of jira column header?
	var rawMarkup = strTestStepsRaw;
	rawMarkup = rawMarkup.replace(/\s*?\n/g, "\n");		// kill whitespace preceeding newline
	rawMarkup = rawMarkup.replace(/\|\s*?/, "|");		// kill whitespace trailing |
	rawMarkup = rawMarkup.replace(/\|\n/g, "|EOJR");	// avoid using | in split action later
	rawMarkup = rawMarkup.replace(/\|\|\n/g, "||EOJR");	// avoid using || in split action later
	//alert(rawMarkup);
	//allRows = rawMarkup.split(/(\||\|\|)\s*?\n/);
	//var allRows = rawMarkup.split(/(\||\|\|)\n/);
	var allWikiRows = rawMarkup.split('EOJR');
	var allTableRows = [];

	var strOutput = "";
	for (var i = 0; i < allWikiRows.length; i++) {
		var rawRow = allWikiRows[i];
		//alert("0: " + allRows[0] + "\n1: " + allRows[1]);
		//alert(i + ": " + allRows[i] + "\n");
		
		//strOutput += i + ": " + allRows[i] + "\n";
		strOutput += "\n\nrow[" + i + "]:\n";
		rawRow = rawRow.replace(/\|\|/g, "EOJC");	// use EOJCH?
		rawRow = rawRow.replace(/\|/g, "EOJC");
		//var allCells = allRows[i].split(/(\|\||\|)/);
		var rowOfCells = rawRow.split('EOJC');

		// kill off 'empty' cells at beginning/end of row
		rowOfCells.shift();
		rowOfCells.pop();

		allTableRows.push(rowOfCells);

		for (var j = 0; j < rowOfCells.length; j++) {
			strOutput += "  cell[" + j + "]: <" + rowOfCells[j] + ">, ";
		}
	}
	//alert(strOutput);

	/****************
	Add table control
	****************/
	var tableEdit = document.createElement("table");
	tableEdit.border = "1";
	tableEdit.style.display = "none";
	tableEdit.style.width = "100%";

	for (var i = 0; i < allTableRows.length; i++) {
		var rowEdit = document.createElement("tr");
		var cellHeightTallest = 5;

		// find 'tallest' (most \n) cell contents
		/*for (var j = 0; j < allTableRows[i].length; j++) {
			cellText = allTableRows[i][j];
			var cellHeight = cellText.match(/\n/g) ? cellText.match(/\n/g).length : 0;
			cellHeightTallest = cellHeight > cellHeightTallest ? cellHeight : cellHeightTallest;
		}*/

		for (var j = 0; j < allTableRows[i].length; j++) {
			var cellEdit = document.createElement("td");
			var textEdit = document.createElement("textarea");
			cellText = allTableRows[i][j];
			textEdit.value = cellText;
			textEdit.cols = "30";
			//cellEdit.style.width = "25%";
			//textEdit.style.width = "100%";
			//textEdit.style.height = "100%";
			//textEdit.rows = (cellHeightTallest + 2);

			//textEdit.style.height = "100%";
			//textEdit.style.width = textEdit.parent.style.width;
			
			stretchy(textEdit);

			if (i > 0) {
				cellEdit.appendChild(textEdit);
			}
			else {
				cellEdit.innerHTML = "<b>" + cellText + "</b>";
			}
			rowEdit.appendChild(cellEdit);
		}
		tableEdit.appendChild(rowEdit);
	}

	return tableEdit;
}



/****************
convertTableToRawjira(table obj) -> string

input: table DOM object
output: string containing a Confluence-formatted table
****************/
function convertTableToRawjira(tableEdit) {
	var rawJira = "";

	// loop through each row/cell of tableEdit, appending to rawJira

	return rawJira;
}


/****************
toggleVisibility

toggles visibility of:
- EL_JIRA_EDIT_TEXTAREA
- EL_TW_EDIT_TABLE
- EL_TW_EDIT_BUTTON
- EL_TW_SAVE_BUTTON
- EL_TW_CANCEL_BUTTON
****************/
function toggleVisibility() {
	var arrElements = [ EL_JIRA_EDIT_TEXTAREA, EL_TW_EDIT_TABLE, EL_TW_EDIT_BUTTON, EL_TW_SAVE_BUTTON, EL_TW_CANCEL_BUTTON ];

	for (i = 0; i < arrElements.length; i++) {
		var element = document.getElementById(arrElements[i]);

		if (element != null) {
			element.style.display = element.style.display == "none" ? "inherit" : "none";
		}
	}
}

/****************
saveTableToRawjira


****************/
function saveTableToRawjira() {
	var rawJira = convertTableToRawjira(document.getElementById(EL_TW_EDIT_TABLE));
}

/****************
editRawjiraInTable - done?

****************/
function editRawjiraInTable() {
	// find/delete any existing EL_TW_EDIT_TABLE
	var oldTableEdit = document.getElementById(EL_TW_EDIT_TABLE);
	if (oldTableEdit != null) {
		divEditButtons.removeChild(oldTableEdit);
	}

	// create new table, populate, add to div
	var rawMarkup = taTestSteps.value;
	var tableEdit = document.createElement("table");
	tableEdit = convertRawjiraToTable(rawMarkup);
	tableEdit.setAttribute("id", EL_TW_EDIT_TABLE);
	divEditButtons.appendChild(tableEdit);
}

/****************
Add/setup page controls
****************/
//divEditButtons.appendChild(tableEdit);

/*
var tableEdit = document.createElement("table");
//*/

//var newTableEdit = document.createElement("table");

//tableEdit = convertRawjiraToTable("|| test ||\n| test |");

/*
tableEdit = convertRawjiraToTable(rawMarkup);
tableEdit.setAttribute("id", EL_TW_EDIT_TABLE);
divEditButtons.appendChild(tableEdit);
//*/

//newTableEdit = convertRawjiraToTable(rawMarkup);
//divEditButtons.replaceChild(tableEdit, newTableEdit);
//divEditButtons.removeChild(divEditButtons.lastChild);
//divEditButtons.appendChild(newTableEdit);

//taTestSteps.class = "hidden";
//var saveEditControl = document.createElement("div");
var saveEditControl = document.createElement("input");

//var testDeleteControl = document.createElement("div");
//saveEditControl.href = "#";
//saveEditControl.innerHTML = "[ edit button ]";
saveEditControl.type = "button";
saveEditControl.value = "Edit";
//testDeleteControl.innerHTML = "[ delete! ]";
//saveEditControl.onclick = "alert('test');";
saveEditControl.onclick = function() { 
	editRawjiraInTable();
	toggleVisibility();
	//saveTableToRawjira();
	

	// toggle visibility
	//taTestSteps.style.display = taTestSteps.style.display == "none" ? "inherit" : "none";
	//tableEdit.style.display = tableEdit.style.display == "none" ? "inherit" : "none";
	//taTestSteps.style.display = "none";


};

/*
testDeleteControl.onclick = function() {
	var elementToDelete = document.getElementById(EL_TW_EDIT_TABLE);

	divEditButtons.removeChild(elementToDelete);
};//*/

//divEditButtons.appendChild(saveEditControl);
//divEditButtons.appendChild(testDeleteControl);
//divEditButtons.insertBefore(testDeleteControl, divEditButtons.childNodes[0]);
divEditButtons.insertBefore(document.createElement("br"), divEditButtons.childNodes[0]);	// add a linebreak!
divEditButtons.insertBefore(saveEditControl, divEditButtons.childNodes[0]);


