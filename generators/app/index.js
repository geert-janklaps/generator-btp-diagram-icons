"use strict";
const Generator = require("yeoman-generator");
const chalk = require("chalk");
const yosay = require("yosay");

const { createSVGWindow } = require("svgdom");
const { SVG, registerWindow } = require("@svgdotjs/svg.js");
const fs = require("fs");
const sizeOf = require("image-size");

module.exports = class extends Generator {
  prompting() {
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
      },
      {
        type: "confirm",
        name: "sap",
        message: "Do you want to generate SAP icons?",
        default: true
      },
      {
        type: "confirm",
        name: "groupbycategory",
        message: "Do you want to group icons by category?",
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
    this.log("Getting services from SAP discovery-center");
    let btpServices = await got
      .get(
        "https://discovery-center.cloud.sap/servicecatalog/Services?$orderby=Category,AdditionalCategories",
        { responseType: "json" }
      )
      .json();

    // Get icons (returns promise)
    this.log("Downloading service icons");
    btpServices = await btpServices.d.results.map(async element => {
      let svg = await got.get(element.Icon).then(response => {
        return response;
      });

      element.extension = element.Icon.substr(
        element.Icon.lastIndexOf(".") + 1
      );

      element.Category = element.Category.replaceAll("/", "-").trim();
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
      let path = "";
      this.log(`Processing: ${element.Name}`);

      if (this.props.circle === true) {
        element.circledsvg = this.generateCircledIcon(element);
      }

      if (this.props.groupbycategory === true) {
        path = `btp/regular/${element.Category}/${element.filename}.${element.extension}`;
      } else {
        path = `btp/regular/${element.filename}.${element.extension}`;
      }

      if (element.extension === "svg") {
        this.fs.write(this.destinationPath(path), element.svg);
      } else {
        this.fs.write(this.destinationPath(path), element.binary);
      }
    });

    // Generate SAP Icons
    if (this.props.sap === true) {
      const sapicons = require("@ui5/webcomponents-icons/dist/generated/assets/v5/SAP-icons.json");
      const tnticons = require("@ui5/webcomponents-icons-tnt/dist/generated/assets/SAP-icons-TNT.json");
      const businesssuiteicons = require("@ui5/webcomponents-icons-business-suite/dist/generated/assets/SAP-icons-business-suite.json");

      this.generateSAPIcons(sapicons);
      this.generateSAPIcons(tnticons);
      this.generateSAPIcons(businesssuiteicons);
    }
  }

  generateCircledIcon(service) {
    let svg;
    let path = "";

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

    // Create circle
    canvas
      .circle("46")
      .stroke({ color: "#074d92", opacity: 1, width: 2 })
      .fill({ color: "#FFFFFF", opacity: 1 })
      // .fill("none")
      .center("50%", "50%");

    // Add original icon to canvas (as nested svg)
    let nested = canvas.nested();
    nested.viewbox(0, 0, 56, 56);
    if (service?.extension === "svg") {
      // Embed original svg inside new svg
      nested.svg(svg);
    } else {
      // Embed original icon as base64 encoded string inside the new svg
      let image = nested.image();
      image.attr(
        "xlink:href",
        `data:image/${service?.extension};base64,${service?.binary.toString(
          "base64"
        )}`,
        "http://www.w3.org/1999/xlink"
      );
    }

    nested.height(30);
    nested.x(0).y("25%");

    // Get original svg and set size to 100% (width & height)
    let icon = nested.first();
    icon.height("100%");
    icon.width("100%");

    if (this.props.groupbycategory === true) {
      path = `btp/circled/${service?.Category}/${service?.filename}.svg`;
    } else {
      path = `btp/circled/${service?.filename}.svg`;
    }

    this.fs.write(this.destinationPath(path), canvas.svg());

    return canvas.svg();
  }

  generateSAPIcons(iconpackage) {
    let path = "";

    if (iconpackage === undefined) {
      return;
    }

    Object.keys(iconpackage?.data).forEach(iconname => {
      let icondata = iconpackage?.data[iconname];
      let svgicon = `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 510 510" preserveAspectRatio="xMidYMid">
                    <defs><style>.cls-1{fill:#595959;}</style></defs>
                    <title>${iconname}</title>
                    <g id="Layer_2" data-name="Layer 2"><g id="${iconname}">
                    <path class="cls-1" d="${icondata.path}"></path>
                    </g></g>
                    </svg>`;

      if (this.props.groupbycategory === true) {
        path = `icons/${iconpackage?.collection}/${iconname}.svg`;
      } else {
        path = `icons/${iconname}.svg`;
      }

      this.fs.write(this.destinationPath(path), svgicon);
    });
  }

  async install() {
    let libraries = [];

    if (this.props.groupbycategory === true) {
      fs.readdirSync(`${this.destinationPath()}/btp/regular`).forEach(
        library => {
          libraries.push({
            library: `BTP - Regular - ${library}`,
            path: `${this.destinationPath()}/btp/regular/${library}`
          });
        }
      );

      fs.readdirSync(`${this.destinationPath()}/btp/circled`).forEach(
        library => {
          libraries.push({
            library: `BTP - Circled - ${library}`,
            path: `${this.destinationPath()}/btp/circled/${library}`
          });
        }
      );

      fs.readdirSync(`${this.destinationPath()}/icons`).forEach(library => {
        libraries.push({
          library: `Icons - ${library}`,
          path: `${this.destinationPath()}/icons/${library}`
        });
      });
    } else {
      libraries.push({
        library: "BTP - Regular",
        path: `${this.destinationPath()}/btp/regular`
      });

      libraries.push({
        library: "BTP - Circled",
        path: `${this.destinationPath()}/btp/circled`
      });

      libraries.push({
        library: "Icons",
        path: `${this.destinationPath()}/icons`
      });
    }

    // Generate Draw.io library
    libraries.forEach(library => {
      let files = fs.readdirSync(library.path);
      let drawiolibrary = [];

      files.forEach(file => {
        let extension = file.substring(file.lastIndexOf(".") + 1);
        let name = file.substring(0, file.lastIndexOf("."));
        let base64 = fs
          .readFileSync(`${library.path}/${file}`)
          .toString("base64");

        let dimensions = sizeOf(`${library.path}/${file}`);

        if (extension === "svg") {
          extension = "svg+xml";
        }

        drawiolibrary.push({
          data: `data:image/${extension};base64,${base64}`,
          title: name,
          aspect: "fixed",
          w: dimensions.width,
          h: dimensions.height
        });
      });

      let xml = `<mxlibrary>${JSON.stringify(drawiolibrary)}</mxlibrary>`;
      this.fs.write(
        this.destinationPath(`libraries/draw-io/${library.library}.xml`),
        xml
      );

      drawiolibrary = [];
    });
  }
};
