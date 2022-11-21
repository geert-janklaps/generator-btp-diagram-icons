"use strict";
const Generator = require("yeoman-generator");
const chalk = require("chalk");
const yosay = require("yosay");

const { createSVGWindow } = require("svgdom");
const { SVG, registerWindow } = require("@svgdotjs/svg.js");

module.exports = class extends Generator {
  prompting() {
    // Have Yeoman greet the user.
    this.log(
      yosay(
        `Welcome to the ${chalk.red(
          "SAP Business Technology Platform (BTP) diagram icon generator"
        )} !`
      )
    );

    const prompts = [
      {
        type: "confirm",
        name: "circle",
        message: "Do you want to generate circled icons?",
        default: true
      }
    ];

    return this.prompt(prompts).then(props => {
      // To access props later use this.props.someAnswer;
      this.props = props;
    });
  }

  async writing() {
    const { got } = await import("got");

    // Get BTP services
    let btpServices = await got
      .get(
        "https://discovery-center.cloud.sap/servicecatalog/Services?$orderby=Category,AdditionalCategories",
        { responseType: "json" }
      )
      .json();

    // Get icons (returns promise)
    btpServices = await btpServices.d.results.map(async element => {
      let svg = await got.get(element.Icon).then(response => {
        return response;
      });

      element.extension = element.Icon.substr(
        element.Icon.lastIndexOf(".") + 1
      );
      element.filename = element.Name.replaceAll("/", "")
        .replaceAll(" ", "-")
        .replaceAll(",", "-");
      element.svg = svg.body;
      element.binary = svg.rawBody;

      return element;
    });

    // Await promises to resolve
    btpServices = await Promise.all(btpServices).then(result => {
      return result;
    });

    // Write files
    btpServices.forEach(element => {
      console.log(element.Name);

      if (this.props.circle === true && element.extension === "svg") {
        this.generateCircledIcon(element);
      }

      if (element.extension === "svg") {
        this.fs.write(
          this.destinationPath(
            "regular/" + element.filename + "." + element.extension
          ),
          element.svg
        );
      } else {
        this.fs.write(
          this.destinationPath(
            "regular/" + element.filename + "." + element.extension
          ),
          element.binary
        );
      }
    });
  }

  generateCircledIcon(service) {
    let svg;

    if (service === undefined) {
      return;
    }

    // Remove potential doctype declaration
    svg = service?.svg.substring(service?.svg.indexOf("<svg"));

    let window = createSVGWindow();
    let document = window.document;

    // Register window and document
    registerWindow(window, document);

    // Create canvas
    let canvas = SVG(document.documentElement);
    canvas.viewbox(0, 0, 56, 56);

    // Add original icon to canvas (as nested svg)
    let nested = canvas.nested();
    nested.viewbox(0, 0, 56, 56);
    nested.svg(svg);
    nested.height(30);
    nested.x(0).y("25%");

    // Get original svg and set size to 100% (width & height)
    let icon = nested.first();
    icon.height("100%");
    icon.width("100%");

    // Create circle
    canvas
      .circle("46")
      .stroke({ color: "#074d92", opacity: 1, width: 2 })
      // .fill({ color: '#074d92', opacity: 0 })
      .fill("none")
      .center("50%", "50%");

    this.fs.write(
      this.destinationPath(
        "circled/" + service?.filename + "." + service?.extension
      ),
      canvas.svg()
    );
  }

  install() {
    // This.installDependencies();
  }
};
