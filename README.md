# Knitout (Live) Visualizer

Visualizer for knitout files, javascript files that print knitout with `console.log`, and javascript files that output knitout using knitout-frontend-js. Includes code editing support so you can edit-and-test within the interface.

<table>
<tr><td><a href="#installation">Installation</a></td><td><a href="#usage">Usage</a></td><td><a href="#troubleshooting">Troubleshooting</a></td></tr>
</table>

## <a name="installation"></a>Installation

In the command line, type:
```console
git clone https://github.com/textiles-lab/knitout-live-visualizer
```
Next, change into the working directory by typing:
```console
cd knitout-live-visualizer
```
(*note: if you installed the repo in a subdirectory, make sure to type out the full path.*)

If you have trouble opening the file, you likely need to run the following commands:
```console
git submodule init
git submodule update
```
^*These commands initialize and update the submodules (other Git repos) that the visualizer depends on.*

See the github documentation on [cloning a repository](https://docs.github.com/en/free-pro-team@latest/github/creating-cloning-and-archiving-repositories/cloning-a-repository) if you need assistance with installation.

## <a name="usage"></a>Usage

From the 'knitout-live-visualizer' folder on your computer, open the visualizer.html file in a browser.

Click the 'Load a knitout or js file' button to open a local file.

Once a file is loaded, you can add/delete lines of code (with live error checking/support), and update the visualizer by pressing the 'Run/Show' button. The 'Reload' button will discard those edits and restore the file to its original state. (*note: editing the file in the visualizer will not make alterations to the local file.*)

If using a javascript file, you can check the 'Show Knitout' box for a preview of the output knitout, or press 'Save Knitout' to download the file to your computer.

Highlighting a line of source code highlights the stitches made by that line.
Clicking a stitch should take you to the line of code that made that stitch.

`visualizer.html` is the does-everything visualizer.

`simplified-visualizer.html` only handles knitout files and doesn't have a code editor.

## <a name="troubleshooting"></a>Troubleshooting
If you have any trouble, discover a bug, or want to provide feedback, feel free to use the [Issues](https://github.com/textiles-lab/knitout-live-visualizer/issues) page.\
