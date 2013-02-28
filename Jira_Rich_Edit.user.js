// ==UserScript==
// @name        Jira Rich Edit
// @namespace   https://jira.trustwave.com
// @description (by Andy George) Allows for WYSIWYG editing of some Jira fields
// @include     http://jira.trustwave.com/*
// @include     https://jira.trustwave.com/*
// @version     2013-02-28
// @grant       none
// ==/UserScript==

/* KNOWN ISSUES:
- doesn't really handle multiple linebreaks in textareas too well, gotta convert that to jira "\\" strings in a better fashion
- using the 'preview' icon button doesn't (yet) hide the edit buttons; figure out logic to do that
- only supports a single table
*/

/* New with Jira 5.2:
- in-line edit (clicking directly on the field) isn't detected by this script
- clicking on Edit doesn't navigate to edit page, and instead opens a dialog on the current screen. Also not detected by this script.

Stuff I've found out:
- in-line: editing creates a form  (id='customfield_10043-form')
- in-line: edit div is still named 'customfield_10043-wiki-edit', but obviously isn't always detected
- Edit dialog: edit link contains a span with class 'trigger-text', which may be what creates the dialog, versus loading an EditIssue page
- Edit dialog: div seems to be called 'customfield_10043-val'
*/

/* TODO:
basic:
- add new row - DONE
- delete existing row
- move row (drag and drop) - DONE
- 

formatting:
- make table look nicer
- better organize button controls
*/

/****************
element ID strings
****************/
var EL_JIRA_EDIT_DIV = "customfield_10043-wiki-edit";			// (existing) div we place our new magical controls into
var EL_JIRA_EDIT_TEXTAREA = "customfield_10043";				// (existing) main wiki edit textarea
var EL_JIRA_PREVIEW_BUTTON = "customfield_10043-preview_link";	// (existing) image button that toggles jira preview. we should disable this when in table edit mode
var EL_TW_EDIT_TABLE = "Jira_Rich_Edit-tableEdit";				// (new) editing table
var EL_TW_EDIT_BUTTON = "Jira_Rich_Edit-edit_button";			// (new) edit button, moves to table edit state
var EL_TW_SAVE_BUTTON = "Jira_Rich_Edit-save_button";			// (new) save button, copies table info to jira, moves to jira edit state
var EL_TW_CANCEL_BUTTON = "Jira_Rich_Edit-cancel_button";		// (new) cancel button, moves to jira edit state
var EL_TW_ADDROW_BUTTON = "Jira_Rich_edit-addrow-button";		// (new) add row button, creates new row in table edit state


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
Identify existing elements
****************/
var divEditButtons = document.getElementById(EL_JIRA_EDIT_DIV);
var taTestSteps = document.getElementById(EL_JIRA_EDIT_TEXTAREA); // works
var previewButton = document.getElementById(EL_JIRA_PREVIEW_BUTTON);
stretchy(taTestSteps);	// maybe turn this off? make configurable?


/****************
from http://forums.sureshkumar.net/web-designing-development-promotion-seo/38245-html-javascript-editable-tables-sample-code.html

only needed for:
- convertRawjiraToTableNew()
- convertTableToRawjiraNew()
****************/
function changeContent(tablecell)
{
	// we don't want to fire this off if the contents are <textarea> (ie, if textarea is being edited)
	var regexTextareaTag = /(<textarea>)/ig; // kill html tags, if needed

	if (tablecell.innerHTML.match(regexTextareaTag) == null) {	// don't do this while we're in the text area. not sure how else to control this
	    //alert(tablecell.firstChild.nodeValue);
	    var tempInputControl = document.createElement("textarea");
	    tempInputControl.onblur = function() {
	    	submitNewName(this);
	    }
	    tempInputControl.type = "text";
	    //alert(tempInputControl.tagName);
	    tempInputControl.value = tablecell.innerHTML;
	    tablecell.innerHTML = "";
	    stretchy(tempInputControl);
	    tablecell.appendChild(tempInputControl);
	    //tablecell.innerHTML = "<INPUT type=text name=newname onBlur=\"javascript:submitNewName(this);\" value=\""+tablecell.innerHTML+"\">";
	    tablecell.firstChild.focus();
	}
}
function submitNewName(textfield)
{
    //alert(textfield.value);
    //alert(textfield.tagName);
    textfield.parentNode.innerHTML= textfield.value;
}

/****************
convertRawjiraToTableNew(string) -> table obj

This is an updated version of convertRawjiraToTable.

input: string containing a Confluence-formatted table
output: table DOM object
****************/
function convertRawjiraToTableNew(strTestStepsRaw) {
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

		for (var j = 0; j < allTableRows[i].length; j++) {
			var cellEdit;
			var cellText = allTableRows[i][j];

			if (i == 0) {
				cellEdit = document.createElement("th");
			}
			else {
				cellEdit = document.createElement("td");
			}

			cellEdit.innerHTML = cellText;

			cellEdit.onclick = function() {
				changeContent(this);
			}

			rowEdit.appendChild(cellEdit);
		}
		tableEdit.appendChild(rowEdit);
	}

	return tableEdit;
}

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
	//tableEdit.style.width = "100%";

	for (var i = 0; i < allTableRows.length; i++) {
		var rowEdit = document.createElement("tr");
		var cellHeightTallest = 5;

		for (var j = 0; j < allTableRows[i].length; j++) {
			var cellEdit;
			var cellText = allTableRows[i][j];

			if (i == 0) {
				cellEdit = document.createElement("th");
				cellEdit.innerHTML = cellText;
				rowEdit.setAttribute("NoDrag", true);
			}
			else {
				cellEdit = document.createElement("td");

				var textEdit = document.createElement("textarea");
				textEdit.value = cellText;
				textEdit.cols = "30";
				//cellEdit.style.width = "25%";
				//textEdit.style.width = "100%";
				//textEdit.style.height = "100%";
				//textEdit.rows = (cellHeightTallest + 2);

				//textEdit.style.height = "100%";
				//textEdit.style.width = textEdit.parent.style.width;
				
				stretchy(textEdit);
				cellEdit.appendChild(textEdit);
			}

			rowEdit.appendChild(cellEdit);
		}
		tableEdit.appendChild(rowEdit);
	}

	return tableEdit;
}

/****************
convertTableToRawjiraNew(table obj) -> string

input: table DOM object
output: string containing a Confluence-formatted table
****************/
function convertTableToRawjiraNew(tableEdit) {
	var rawJira = "";
	var rawOutput = "";
	var regexHTMLTags = /(<([^>]+)>)/ig; // kill html tags, if needed
	var regexMultipleSpaces = / {2,}/g;

	for (i = 0; i < tableEdit.rows.length; i++) {
		//
		for (j = 0; j < tableEdit.rows[i].cells.length; j++) {
			var currCell = tableEdit.rows[i].cells[j];
			var cellContents = "";

			cellContents = currCell.innerHTML;

			rawJira += "| ";
			if (cellContents != null) {
				rawJira += cellContents;
			}
			else {
				rawJira += "!!";
			}
			//rawJira += "|";
			//rawJira += tableEdit.rows[i].cells[j] + " ";
		}

		if (i < tableEdit.rows.length) {
			rawJira += " |\n";		// whyyyyyyyyyyy
		}
	}

	//rawJira += " |\n";

	rawOutput = rawJira.replace(regexMultipleSpaces, " ");
	//rawOutput = rawJira.replace("  ", " ");
	return rawOutput;
}

/****************
convertTableToRawjira(table obj) -> string

input: table DOM object
output: string containing a Confluence-formatted table
****************/
function convertTableToRawjira(tableEdit) {
	var rawJira = "";
	var rawOutput = "";
	var regexHTMLTags = /(<([^>]+)>)/ig; // kill html tags, if needed
	var regexMultipleLinebreaks = /\n{2,}/g;
	var regexMultipleSpaces = / {2,}/g;

	for (i = 0; i < tableEdit.rows.length; i++) {
		//
		rawJira += "|";
		for (j = 0; j < tableEdit.rows[i].cells.length; j++) {
			var currCell = tableEdit.rows[i].cells[j];
			var textAreaContents = "";

			if (i == 0) {
				textAreaContents = "|" + currCell.innerHTML;
				//textAreaContents = textAreaContents.replace(regexHTMLTags, "");
			}
			else {
				textAreaContents = currCell.childNodes[0].value;
			}

			//rawJira += "| ";
			if (textAreaContents != null) {
				if (textAreaContents.length > 0) {
					rawJira += textAreaContents;
				}
				else {
					rawJira += " ";
				}
			}
			else {
				rawJira += "!!";
			}
			rawJira += "|";

			//rawJira += tableEdit.rows[i].cells[j] + " ";
		}

		if (i == 0) {
			rawJira += "|";
		}

		if (i < tableEdit.rows.length - 1) {
			rawJira += " \n";
		}
	}

	//rawJira += " |\n";

	rawOutput = rawJira.replace(regexMultipleSpaces, " ");
	//rawOutput = rawOutput.replace(regexMultipleLinebreaks, "\n\\\\\n"); // still not sure on this, users can def still break formatting
	//rawOutput = rawJira.replace("  ", " ");
	return rawOutput;
}


/****************
toggleVisibility

toggles visibility of:
- EL_JIRA_EDIT_TEXTAREA
- EL_TW_EDIT_TABLE
- EL_TW_EDIT_BUTTON
- EL_TW_SAVE_BUTTON
- EL_TW_CANCEL_BUTTON
- EL_JIRA_PREVIEW_BUTTON
- EL_TW_ADDROW_BUTTON
****************/
function toggleVisibility() {
	var arrElements = [ 
	  EL_JIRA_EDIT_TEXTAREA,
	  EL_TW_EDIT_TABLE,
	  EL_TW_EDIT_BUTTON,
	  EL_TW_SAVE_BUTTON,
	  EL_TW_CANCEL_BUTTON,
	  EL_JIRA_PREVIEW_BUTTON,
	  EL_TW_ADDROW_BUTTON
	];

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
	//var rawJira = convertTableToRawjiraNew(document.getElementById(EL_TW_EDIT_TABLE));

	//alert(rawJira);
	taTestSteps.value = rawJira;
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

	// create new table, populate
	var rawMarkup = taTestSteps.value;
	var tableEdit = document.createElement("table");
	tableEdit = convertRawjiraToTable(rawMarkup);
	//tableEdit = convertRawjiraToTableNew(rawMarkup);
	tableEdit.setAttribute("id", EL_TW_EDIT_TABLE);

	// create 'new row' button
	/*
	var addrowButton = document.createElement("input");
	addrowButton.type = "button";
	addrowButton.value = "Add New Row";
	addrowButton.setAttribute("id", EL_TW_ADDROW_BUTTON);
	addrowButton.style.display = "none";
	//*/
	//addrowButton.onclick = function() {
		//
	//}

	// add items to div
	//divEditButtons.insertBefore(addrowButton, divEditButtons.childNodes[0]);
	//alert("add 'add' button");
	divEditButtons.appendChild(tableEdit);

	//var tableDnD = new TableDnD();
	//tableDnD.init(tableEdit);
}

/****************
addBlankRow - add a new html row (with textarea controls) to a single table

input: string tableID
****************/
function addBlankRow(tableID) {
	var table = document.getElementById(tableID);
	//var columns = table.childNodes[0].childNodes.length;
	//alert(table.childNodes[0].type);
	var headerRow;
	var columns = 0;
	var newRow = document.createElement("tr");

	if (table != null) {
		//headerRow = table.rows[0];
		columns = table.rows[0].childNodes.length;
		//alert("header row count: " + headerRow.childNodes.length);
		
		// build new row
		for (i = 0; i < columns; i += 1) {
			var newCell = document.createElement("td");
			var newTextEdit = document.createElement("textarea");
			newTextEdit.value = "";
			newTextEdit.cols = "30";
			
			stretchy(newTextEdit);
			newCell.appendChild(newTextEdit);

			newRow.appendChild(newCell);
		}

		table.appendChild(newRow);
	}
	else {
		// do anything? table doesn't exist
	}
}



/////////////////////////////////////////////////////////////////////

// ===================================================================
// Author: Denis Howlett <feedback@isocra.com>
// WWW: http://www.isocra.com/
//
// NOTICE: You may use this code for any purpose, commercial or
// private, without any further permission from the author. You may
// remove this notice from your final code if you wish, however we
// would appreciate it if at least the web site address is kept.
//
// You may *NOT* re-distribute this code in any way except through its
// use. That means, you can include it in your product, or your web
// site, or any other form where the code is actually being used. You
// may not put the plain javascript up on your site for download or
// include it in your javascript libraries for download.
// If you wish to share this code with others, please just point them
// to the URL instead.
//
// Please DO NOT link directly to this .js files from your site. Copy
// the files to your server and use them there. Thank you.
//
// Edit: Andy George
// This has been edited a little for specific Jira use:
// - removed references to tBodies collections
// - made 'textarea' controls undraggable
// - killed off the 'ondrop' actions used in the Jira Drag and Drop script
// ===================================================================

/** Keep hold of the current table being dragged */
var currenttable = null;

/** Capture the onmousemove so that we can see if a row from the current
 *  table if any is being dragged.
 * @param ev the event (for Firefox and Safari, otherwise we use window.event for IE)
 */
document.onmousemove = function(ev){
    if (currenttable && currenttable.dragObject) {
        ev   = ev || window.event;
        var mousePos = currenttable.mouseCoords(ev);
        var y = mousePos.y - currenttable.mouseOffset.y;
        if (y != currenttable.oldY) {
            // work out if we're going up or down...
            var movingDown = y > currenttable.oldY;
            // update the old value
            currenttable.oldY = y;
            // update the style to show we're dragging
            currenttable.dragObject.style.backgroundColor = "#eee";
            // If we're over a row then move the dragged row to there so that the user sees the
            // effect dynamically
            var currentRow = currenttable.findDropTargetRow(y);
            if (currentRow) {
                if (movingDown && currenttable.dragObject != currentRow) {
                    currenttable.dragObject.parentNode.insertBefore(currenttable.dragObject, currentRow.nextSibling);
                } else if (! movingDown && currenttable.dragObject != currentRow) {
                    currenttable.dragObject.parentNode.insertBefore(currenttable.dragObject, currentRow);
                }
            }
        }

        return false;
    }
}

// Similarly for the mouseup
document.onmouseup   = function(ev){
    if (currenttable && currenttable.dragObject) {
        var droppedRow = currenttable.dragObject;
        // If we have a dragObject, then we need to release it,
        // The row will already have been moved to the right place so we just reset stuff
        droppedRow.style.backgroundColor = 'transparent';
        currenttable.dragObject   = null;
        // And then call the onDrop method in case anyone wants to do any post processing
        currenttable.onDrop(currenttable.table, droppedRow);
        currenttable = null; // let go of the table too
    }
}


/** get the source element from an event in a way that works for IE and Firefox and Safari
 * @param evt the source event for Firefox (but not IE--IE uses window.event) */
function getEventSource(evt) {
    if (window.event) {
        evt = window.event; // For IE
        return evt.srcElement;
    } else {
        return evt.target; // For Firefox
    }
}

/**
 * Encapsulate table Drag and Drop in a class. We'll have this as a Singleton
 * so we don't get scoping problems.
 */
function TableDnD() {
    /** Keep hold of the current drag object if any */
    this.dragObject = null;
    /** The current mouse offset */
    this.mouseOffset = null;
    /** The current table */
    this.table = null;
    /** Remember the old value of Y so that we don't do too much processing */
    this.oldY = 0;

    /** Initialise the drag and drop by capturing mouse move events */
    this.init = function(table) {
        this.table = table;
        //var rows = table.tBodies[0].rows; //getElementsByTagName("tr")
        var rows = table.rows; //getElementsByTagName("tr")
        for (var i=0; i<rows.length; i++) {
			// John Tarr: added to ignore rows that I've added the NoDnD attribute to (Category and Header rows)
			var nodrag = rows[i].getAttribute("NoDrag")
			if (nodrag == null || nodrag == "undefined") { //There is no NoDnD attribute on rows I want to drag
				this.makeDraggable(rows[i]);
			}
        }
    }

    /** This function is called when you drop a row */
    this.onDrop = function(table, droppedRow) {
        //var rows = table.tBodies[0].rows;
        // TODO - do NOT redirect if there's no rearranging to be done

        var subTaskSequence = droppedRow.rowIndex // this will be the updated location of the row
        /*
        var currentSubTaskSequence = null; // this will be the old location, referenced against the issueRows array below

        // loop through issueRows, match droppedRow.id to issueRows[i]
        for (var i = 0; i < issueRows.length; i++) {
        	if (droppedRow.id == issueRows[i]) {
    			currentSubTaskSequence = i;
        	}
        }
        var redirectString = '/secure/MoveIssueLink.jspa?id=' + jiraKey + '&currentSubTaskSequence=' + currentSubTaskSequence + '&subTaskSequence=' + subTaskSequence;
        if (currentSubTaskSequence != subTaskSequence) {
        	window.location = redirectString;
    	}
    	//*/
    }

	/** Get the position of an element by going up the DOM tree and adding up all the offsets */
    this.getPosition = function(e){
        var left = 0;
        var top  = 0;
		/** Safari fix -- thanks to Luis Chato for this! */
		if (e.offsetHeight == 0) {
			/** Safari 2 doesn't correctly grab the offsetTop of a table row
			    this is detailed here:
			    http://jacob.peargrove.com/blog/2006/technical/table-row-offsettop-bug-in-safari/
			    the solution is likewise noted there, grab the offset of a table cell in the row - the firstChild.
			    note that firefox will return a text node as a first child, so designing a more thorough
			    solution may need to take that into account, for now this seems to work in firefox, safari, ie */
			e = e.firstChild; // a table cell
		}

        while (e.offsetParent){
            left += e.offsetLeft;
            top  += e.offsetTop;
            e     = e.offsetParent;
        }

        left += e.offsetLeft;
        top  += e.offsetTop;

        return {x:left, y:top};
    }

	/** Get the mouse coordinates from the event (allowing for browser differences) */
    this.mouseCoords = function(ev){
        if(ev.pageX || ev.pageY){
            return {x:ev.pageX, y:ev.pageY};
        }
        return {
            x:ev.clientX + document.body.scrollLeft - document.body.clientLeft,
            y:ev.clientY + document.body.scrollTop  - document.body.clientTop
        };
    }

	/** Given a target element and a mouse event, get the mouse offset from that element.
		To do this we need the element's position and the mouse position */
    this.getMouseOffset = function(target, ev){
        ev = ev || window.event;

        var docPos    = this.getPosition(target);
        var mousePos  = this.mouseCoords(ev);
        return {x:mousePos.x - docPos.x, y:mousePos.y - docPos.y};
    }

	/** Take an item and add an onmousedown method so that we can make it draggable */
    this.makeDraggable = function(item) {
        if(!item) return;
        var self = this; // Keep the context of the TableDnd inside the function
        item.onmousedown = function(ev) {
            // Need to check to see if we are an input or not, if we are an input, then
            // return true to allow normal processing
            var target = getEventSource(ev);
            if (target.tagName == 'INPUT' || target.tagName == 'SELECT' || target.tagName == 'TEXTAREA') return true;
            currenttable = self;
            self.dragObject  = this;
            self.mouseOffset = self.getMouseOffset(this, ev);
            return false;
        }
        item.style.cursor = "move";
    }

    /** We're only worried about the y position really, because we can only move rows up and down */
    this.findDropTargetRow = function(y) {
        //var rows = this.table.tBodies[0].rows;
        var rows = this.table.rows;
		for (var i=0; i<rows.length; i++) {
			var row = rows[i];
			// John Tarr added to ignore rows that I've added the NoDnD attribute to (Header rows)
			var nodrop = row.getAttribute("NoDrop");
			if (nodrop == null || nodrop == "undefined") {  //There is no NoDnD attribute on rows I want to drag
				var rowY    = this.getPosition(row).y;
				var rowHeight = parseInt(row.offsetHeight)/2;
				if (row.offsetHeight == 0) {
					rowY = this.getPosition(row.firstChild).y;
					rowHeight = parseInt(row.firstChild.offsetHeight)/2;
				}
				// Because we always have to insert before, we need to offset the height a bit
				if ((y > rowY - rowHeight) && (y < (rowY + rowHeight))) {
					// that's the row we're over
					return row;
				}
			}
		}
		return null;
	}
}


/////////////////////////////////////////////////////////////////////

/****************
Add/setup page controls
****************/
var tableDnD = new TableDnD();

//- EL_TW_EDIT_BUTTON
var editButton = document.createElement("input");
editButton.type = "button";
editButton.value = "Edit In Table Mode";
editButton.setAttribute("id", EL_TW_EDIT_BUTTON);
editButton.onclick = function() {
	editRawjiraInTable();
	toggleVisibility();
	tableDnD.init(document.getElementById(EL_TW_EDIT_TABLE));
}

//- EL_TW_CANCEL_BUTTON
var cancelButton = document.createElement("input");
cancelButton.type = "button";
cancelButton.value = "Cancel";
cancelButton.setAttribute("id", EL_TW_CANCEL_BUTTON);
cancelButton.onclick = function() {
	toggleVisibility();
	cancelButton.value = "Cancel";
}
cancelButton.style.display = "none";

//- EL_TW_SAVE_BUTTON
var saveButton = document.createElement("input");
saveButton.type = "button";
saveButton.value = "Save To Jira Format";
saveButton.setAttribute("id", EL_TW_SAVE_BUTTON);
saveButton.onclick = function() {
	saveTableToRawjira();
	toggleVisibility();
	cancelButton.value = "Cancel";
}
saveButton.style.display = "none";

//- EL_TW_ADDROW_BUTTON
var addrowButton = document.createElement("input");
addrowButton.type = "button";
addrowButton.value = "Add New Row";
addrowButton.setAttribute("id", EL_TW_ADDROW_BUTTON);
addrowButton.onclick = function() {
	//alert("test");
	addBlankRow(EL_TW_EDIT_TABLE);
	tableDnD.init(document.getElementById(EL_TW_EDIT_TABLE));
}
addrowButton.style.display = "none";

divEditButtons.insertBefore(document.createElement("br"), divEditButtons.childNodes[0]);	// add a linebreak!
divEditButtons.insertBefore(cancelButton, divEditButtons.childNodes[0]);
divEditButtons.insertBefore(saveButton, divEditButtons.childNodes[0]);
divEditButtons.insertBefore(editButton, divEditButtons.childNodes[0]);

previewButton.parentNode.appendChild(addrowButton);
cancelButton.value = "View Jira Format (discard changes)"
editButton.onclick();