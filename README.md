# Knitout (Live) Visualizer

Visualizer for knitout files, javascript files that print knitout with `console.log`, and javascript files that output knitout using knitout-frontend-js. Includes code editing support so you can edit-and-test within the interface.

You can use the visualizer online by visiting the following site: https://textiles-lab.github.io/knitout-live-visualizer/

<table>
<tr><td><a href="#installation">Installation</a></td><td><a href="#usage">Usage</a></td><td><a href="#troubleshooting">Troubleshooting</a></td></tr>
</table>

## <a name="installation"></a>Local Installation

In the command line, type:
```console
git clone --recursive https://github.com/textiles-lab/knitout-live-visualizer
```

See the github documentation on [cloning a repository](https://docs.github.com/en/free-pro-team@latest/github/creating-cloning-and-archiving-repositories/cloning-a-repository) if you need assistance with installation.

## <a name="usage"></a>Usage

Open the [online version](https://textiles-lab.github.io/knitout-live-visualizer/), or -- if installed locally -- the 'knitout-live-visualizer/visualizer.html' file.

Click the 'Load a knitout or js file' button to open a local file.

Once a file is loaded, you can add/delete lines of code (with live error checking/support), and update the visualizer by pressing the 'Run/Show' button. The 'Reload' button will discard those edits and restore the file to its original state. (*note: editing the file in the visualizer will not make alterations to the local file.*)

If using a javascript file, you can check the 'Show Knitout' box for a preview of the output knitout, or press 'Save Knitout' to download the file to your computer.

Highlighting a line of source code highlights the stitches made by that line.
Clicking a stitch should take you to the line of code that made that stitch.

`visualizer.html` is the does-everything visualizer.

`simplified-visualizer.html` only handles knitout files and doesn't have a code editor.

## <a name="troubleshooting"></a>Troubleshooting
If you have any trouble, discover a bug, or want to provide feedback, feel free to use the [Issues](https://github.com/textiles-lab/knitout-live-visualizer/issues) page.\
