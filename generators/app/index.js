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
        name: "someAnswer",
        message: "Would you like to enable this option?",
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
        return response.body;
      });
      element.svg = svg;
      return element;
    });

    // Await promises to resolve
    btpServices = await Promise.all(btpServices).then(result => {
      return result;
    });

    // Write files
    btpServices.forEach(element => {
      console.log(element.Name);

      // Remove potential doctype declaration
      element.svg = element.svg.substring(element.svg.indexOf("<svg"));

      if (
        element.Name === "SAP Private Link Service" ||
        element.Name === "SAP Data Retention Manager"
      ) {
        return;
      }

      let window = createSVGWindow();
      let document = window.document;

      // Register window and document
      registerWindow(window, document);

      // Create canvas
      let canvas = SVG(document.documentElement);
      canvas.viewbox(0, 0, 56, 56);

      // Add original icon to canvas
      let group = canvas.group();
      group.svg(element.svg);
      group.scale(0.6);
      group.center("50%", "50%");

      // Create circle
      let circle = canvas
        .circle("46")
        .stroke({ color: "#074d92", opacity: 1, width: 2 })
        // .fill({ color: '#074d92', opacity: 0 })
        .fill("none")
        .center("50%", "50%");

      // Create wrapper group
      let circleGroup = canvas.group();
      circleGroup.add(circle);
      circleGroup.add(group);

      this.fs.write(this.destinationPath(element.Name + ".svg"), canvas.svg());

      // This.fs.write( this.destinationPath(element.Name+'.svg'), element.svg.toString());
    });
  }

  install() {
    // This.installDependencies();
  }
};
